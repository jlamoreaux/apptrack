/**
 * Wins board: each logged win's area is editable in place (PATCH /api/wins/:id),
 * and the coverage meter reflects the change without a refetch. This is how
 * onboarding-seeded wins, which arrive untagged, start counting.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { WinsBoard } from "@/components/careerotter/wins-board";
import type { LoggedWin } from "@/components/careerotter/win-capture-bar";

// Radix Select -> lightweight testable equivalent. Every Select on the page
// registers its onValueChange in render order: the capture bar's first, then
// one per win.
const selectHandlers: Array<(value: string) => void> = [];
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
      if (onValueChange) selectHandlers.push(onValueChange);
      return <div>{children}</div>;
    },
    SelectTrigger: Pass,
    SelectValue: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    SelectContent: Pass,
    SelectItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const seeded: LoggedWin[] = [
  {
    id: "w1",
    text: "Migrated Replicate support to CSUP",
    impact_number: null,
    tag: null,
    source: "zero_to_case",
    created_at: "2026-09-16T12:00:00Z",
    edited_at: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  selectHandlers.length = 0;
});

it("says untagged wins count toward nothing, then counts one once it is tagged", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ win: { ...seeded[0], tag: "delivery", edited_at: "2026-09-17T00:00:00Z" } }),
  });
  render(<WinsBoard initialWins={seeded} reviewDate={null} />);

  expect(screen.getByText(/no area yet, so it counts toward nothing/i)).toBeInTheDocument();

  // The last registered Select belongs to the win row (render order).
  const retag = selectHandlers[selectHandlers.length - 1];
  await act(async () => retag("delivery"));

  await waitFor(() => {
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/wins/w1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ tag: "delivery" });
  });
  await waitFor(() =>
    expect(screen.getByText(/The gap is leadership evidence/i)).toBeInTheDocument()
  );
});

it("keeps each win disabled until its own request finishes, not just the latest one", async () => {
  const two: LoggedWin[] = [seeded[0], { ...seeded[0], id: "w2", text: "Second win" }];
  const pending: Array<(v: unknown) => void> = [];
  // Each PATCH stays open until the test resolves it, in order.
  mockFetch.mockImplementation(
    () => new Promise((resolve) => pending.push(resolve))
  );
  render(<WinsBoard initialWins={two} reviewDate={null} />);
  const [, retagFirst, retagSecond] = selectHandlers;

  // Fire and do not return the handler's promise: it stays pending on purpose.
  await act(async () => {
    void retagFirst("delivery");
  });
  await act(async () => {
    void retagSecond("craft");
  });

  // Both rows are busy: the delete buttons (which share the busy state) are disabled.
  const deletes = screen.getAllByRole("button", { name: "Delete win" });
  expect(deletes[0]).toBeDisabled();
  expect(deletes[1]).toBeDisabled();

  // Finishing the second request must not re-enable the first.
  await act(async () => {
    pending[1]({ ok: true, json: async () => ({ win: { ...two[1], tag: "craft" } }) });
  });
  expect(deletes[0]).toBeDisabled();
  expect(deletes[1]).not.toBeDisabled();

  await act(async () => {
    pending[0]({ ok: true, json: async () => ({ win: { ...two[0], tag: "delivery" } }) });
  });
  expect(deletes[0]).not.toBeDisabled();
});

it("clears an area by sending null", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ win: { ...seeded[0], tag: null } }),
  });
  render(
    <WinsBoard initialWins={[{ ...seeded[0], tag: "craft" }]} reviewDate={null} />
  );
  const retag = selectHandlers[selectHandlers.length - 1];
  await act(async () => retag(""));
  await waitFor(() =>
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ tag: null })
  );
});

it("surfaces a failed retag without changing the win", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "nope" }) });
  render(<WinsBoard initialWins={seeded} reviewDate={null} />);
  const retag = selectHandlers[selectHandlers.length - 1];
  await act(async () => retag("delivery"));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/could not update that win's area/i)
  );
  expect(screen.getByText(/no area yet/i)).toBeInTheDocument();
});

it("deletes a win", async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
  render(<WinsBoard initialWins={seeded} reviewDate={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete win" }));
  await waitFor(() =>
    expect(screen.queryByText("Migrated Replicate support to CSUP")).not.toBeInTheDocument()
  );
  expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
});
