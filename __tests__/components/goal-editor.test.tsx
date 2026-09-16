/**
 * The goal editor's PATCH payload. The invariant: a field the user did not touch
 * is never sent, so prefill data the page could not load is never written back
 * as null. That matters because an empty prefill is what a failed or timed-out
 * dashboard read looks like, which is exactly when someone opens this to correct
 * their review date.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { GoalEditor, type CareerGoal } from "@/components/careerotter/goal-editor";

// Radix Select -> a testable equivalent that hands back onValueChange.
let selectOnValueChange: ((value: string) => void) | undefined;
jest.mock("@/components/ui/select", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select: ({
      children,
      onValueChange,
    }: {
      children?: ReactNode;
      onValueChange?: (v: string) => void;
    }) => {
      selectOnValueChange = onValueChange;
      return <div>{children}</div>;
    },
    SelectTrigger: Pass,
    SelectValue: () => <span />,
    SelectContent: Pass,
    SelectItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const STORED: CareerGoal = {
  mode: "promotion",
  role: "Software Engineer",
  level: "Senior",
  target: "Staff Engineer",
  review_date: "2026-12-01",
};

const EMPTY: CareerGoal = {
  mode: null,
  role: null,
  level: null,
  target: null,
  review_date: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  selectOnValueChange = undefined;
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ profile: STORED }),
  });
});

function renderEditor(goal: CareerGoal, onSaved = jest.fn()) {
  render(<GoalEditor open goal={goal} onSaved={onSaved} onOpenChange={() => {}} />);
  return onSaved;
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
}

/** The JSON body of the single PATCH this component sent. */
async function patchedBody() {
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe("/api/careerotter/profile");
  expect(init.method).toBe("PATCH");
  return JSON.parse(init.body);
}

describe("GoalEditor payload", () => {
  it("sends only the field the user changed", async () => {
    renderEditor(STORED);
    fireEvent.change(screen.getByLabelText("Review date"), {
      target: { value: "2027-03-01" },
    });
    save();
    await expect(patchedBody()).resolves.toEqual({ review_date: "2027-03-01" });
  });

  it("does not write over fields it never loaded", async () => {
    // Every field is blank, as it is when the prefill could not be loaded.
    // Setting a date must not null out the stored role, level and target.
    renderEditor(EMPTY);
    fireEvent.change(screen.getByLabelText("Review date"), {
      target: { value: "2027-03-01" },
    });
    save();
    const body = await patchedBody();
    expect(body).toEqual({ review_date: "2027-03-01" });
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("level");
    expect(body).not.toHaveProperty("target");
  });

  it("does not reset an unread mode to the default the select was showing", async () => {
    renderEditor(EMPTY);
    fireEvent.change(screen.getByLabelText("Your role"), {
      target: { value: "Data Engineer" },
    });
    save();
    const body = await patchedBody();
    expect(body).toEqual({ role: "Data Engineer" });
    expect(body).not.toHaveProperty("mode");
  });

  it("sends mode when the user actually picks a different one", async () => {
    renderEditor(STORED);
    // The mocked Select reports upward outside React's event system, so drive
    // the state change through act() before clicking Save.
    act(() => selectOnValueChange?.("job_search"));
    save();
    await expect(patchedBody()).resolves.toEqual({ mode: "job_search" });
  });

  it("clears a field the user emptied on purpose", async () => {
    renderEditor(STORED);
    fireEvent.change(screen.getByLabelText("The ask"), { target: { value: "  " } });
    save();
    await expect(patchedBody()).resolves.toEqual({ target: null });
  });

  it("trims before comparing, so whitespace alone is not a change", async () => {
    renderEditor(STORED);
    fireEvent.change(screen.getByLabelText("Your role"), {
      target: { value: "  Software Engineer  " },
    });
    save();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not call the API at all when nothing changed", async () => {
    renderEditor(STORED);
    save();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("hands the saved row up, not just the edited fields", async () => {
    const onSaved = renderEditor(STORED);
    fireEvent.change(screen.getByLabelText("Review date"), {
      target: { value: "2027-03-01" },
    });
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(STORED));
  });

  it("surfaces the API's error and stays open", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "review_date must be a YYYY-MM-DD date or null" }),
    });
    const onSaved = renderEditor(STORED);
    fireEvent.change(screen.getByLabelText("Review date"), {
      target: { value: "2027-03-01" },
    });
    save();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/YYYY-MM-DD/)
    );
    expect(onSaved).not.toHaveBeenCalled();
  });
});
