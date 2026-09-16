/**
 * Today, the career home. The point of the redesign is that this surface asks
 * for something and shows the user their own recent work, rather than reporting
 * two numbers — so these tests assert the next move, the capture bar, the
 * previously-invisible weekly recap, and the recent-wins list are all present
 * and react to a logged win.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TodayOverview } from "@/components/careerotter/today-overview";
import type { LoggedWin } from "@/components/careerotter/win-capture-bar";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

// Radix Select/Dialog -> inert pass-throughs; this suite is about Today's
// content, and both are exercised by their own components' tests.
jest.mock("@/components/ui/select", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select: Pass,
    SelectTrigger: Pass,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: Pass,
    SelectItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
});

const win = (overrides: Partial<LoggedWin> = {}): LoggedWin => ({
  id: "win-1",
  text: "Shipped the migration",
  impact_number: null,
  tag: "delivery",
  source: "manual",
  created_at: new Date().toISOString(),
  edited_at: null,
  ...overrides,
});

function renderToday(overrides: Partial<Parameters<typeof TodayOverview>[0]> = {}) {
  return render(
    <TodayOverview
      goal={{
        mode: "promotion",
        role: "Software Engineer",
        level: "Senior",
        target: "Staff Engineer",
        review_date: null,
      }}
      zeroToCaseCompleted
      initialWins={[win()]}
      recap={null}
      hasCompEntry
      recentHire={null}
      jobSearch={{ total: 0, interviewing: 0, offers: 0, active: 0 }}
      {...overrides}
    />
  );
}

describe("TodayOverview", () => {
  it("states the goal and the ask in the header", () => {
    renderToday();
    expect(
      screen.getByText("Senior Software Engineer → Staff Engineer")
    ).toBeInTheDocument();
  });

  it("prompts for a goal when nothing is set", () => {
    renderToday({
      goal: { mode: null, role: null, level: null, target: null, review_date: null },
    });
    expect(screen.getByText(/No goal set yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set your goal/i })).toBeInTheDocument();
  });

  it("asks for exactly one next move", () => {
    renderToday();
    expect(screen.getByText("Your next move")).toBeInTheDocument();
    // No review date set, and the log is current -> ask for the date.
    expect(screen.getByRole("heading", { name: /set your review date/i })).toBeInTheDocument();
  });

  it("keeps the capture bar on the page, not one click away", () => {
    renderToday();
    expect(screen.getByLabelText("Log a win")).toBeInTheDocument();
  });

  it("shows the user's recent wins", () => {
    renderToday({
      initialWins: [win(), win({ id: "win-2", text: "Unblocked the data team" })],
    });
    expect(screen.getByText("Recently")).toBeInTheDocument();
    expect(screen.getByText("Shipped the migration")).toBeInTheDocument();
    expect(screen.getByText("Unblocked the data team")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /all 2 wins/i })).toBeInTheDocument();
  });

  it("surfaces the stored weekly recap with a copy action", () => {
    renderToday({
      recap: {
        week_start: "2026-06-08",
        generated_text: "This week I shipped the migration.",
        wins_included: 3,
      },
    });
    expect(screen.getByText("This week I shipped the migration.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy this recap/i })).toBeInTheDocument();
  });

  it("says what is coming when no recap has been generated yet", () => {
    renderToday({ initialWins: [win()], recap: null });
    expect(screen.getByText(/Friday's recap/)).toBeInTheDocument();
  });

  it("updates the next move and the recent list when a win is logged", async () => {
    const logged = win({ id: "win-new", text: "Ran the incident review", tag: "leadership" });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ win: logged }) });

    renderToday({ goal: {
      mode: "promotion",
      role: "Software Engineer",
      level: "Senior",
      target: "Staff Engineer",
      review_date: "2099-01-01",
    } });

    // With one delivery win and a far-off date, Today asks to close the gap.
    expect(screen.getByRole("heading", { name: /log a leadership win/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Log a win"), {
      target: { value: "Ran the incident review" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log it/i }));

    await waitFor(() => {
      expect(screen.getByText("Ran the incident review")).toBeInTheDocument();
    });
    // The leadership gap is closed, so the move moves on.
    expect(
      screen.queryByRole("heading", { name: /log a leadership win/i })
    ).not.toBeInTheDocument();
  });

  it("hides the job-search strip for a user who isn't job hunting", () => {
    renderToday();
    expect(screen.queryByText("Job search")).not.toBeInTheDocument();
  });

  it("shows the job-search strip once there are applications", () => {
    renderToday({ jobSearch: { total: 4, interviewing: 2, offers: 1, active: 3 } });
    expect(screen.getByText("Job search")).toBeInTheDocument();
    expect(screen.getByText(/4 applications/)).toBeInTheDocument();
    expect(screen.getByText(/2 interviewing/)).toBeInTheDocument();
    // Singular: "1 offers" was in the first cut of this strip.
    expect(screen.getByText(/1 offer$/)).toBeInTheDocument();
  });

  it("calls the countdown a target date in job-search mode", () => {
    renderToday({
      goal: {
        mode: "job_search",
        role: "Software Engineer",
        level: "Senior",
        target: "Staff Engineer",
        review_date: "2099-01-01",
      },
      jobSearch: { total: 4, interviewing: 2, offers: 2, active: 3 },
    });
    expect(screen.getByText(/Target in \d+ weeks/)).toBeInTheDocument();
    expect(screen.queryByText(/Review in/)).not.toBeInTheDocument();
  });

  it("asks a new hire to set up the new role", () => {
    renderToday({ recentHire: { company: "Globex", role: "Staff Engineer" } });
    expect(screen.getByRole("heading", { name: /set up your new role/i })).toBeInTheDocument();
    expect(screen.getByText(/Globex/)).toBeInTheDocument();
  });
});
