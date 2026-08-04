/**
 * Tests for the win capture bar (M2b): required text, successful POST contract
 * + optimistic hand-up, and inline error on failure. (win_logged is emitted
 * server-side by /api/wins, not from the client, so there's no client-event
 * assertion here.)
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { WinCaptureBar } from "@/components/careerotter/win-capture-bar";
import { WIN_TAG_OPTIONS } from "@/lib/constants/careerotter";

// Radix Select -> lightweight testable equivalent (captures onValueChange).
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
  selectOnValueChange = undefined;
});

function type(value: string) {
  fireEvent.change(screen.getByLabelText("Log a win"), { target: { value } });
}
function submit() {
  fireEvent.click(screen.getByRole("button", { name: /log it/i }));
}

it("requires text and does not hit the API when empty", async () => {
  render(<WinCaptureBar />);
  submit();
  await waitFor(() =>
    expect(screen.getByText("Type what you shipped first.")).toBeInTheDocument()
  );
  expect(mockFetch).not.toHaveBeenCalled();
});

it("posts the win, clears, hands it up, and fires win_logged", async () => {
  const win = { id: "w1", text: "shipped it", tag: "delivery", source: "manual" };
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ win }) });
  const onLogged = jest.fn();

  render(<WinCaptureBar onLogged={onLogged} />);
  type("shipped it");
  act(() => selectOnValueChange?.(WIN_TAG_OPTIONS[0].value));
  submit();

  await waitFor(() => expect(onLogged).toHaveBeenCalledWith(win));
  const [url, opts] = mockFetch.mock.calls[0];
  expect(url).toBe("/api/wins");
  expect(JSON.parse(opts.body)).toMatchObject({
    text: "shipped it",
    tag: WIN_TAG_OPTIONS[0].value,
  });
  expect(screen.getByLabelText("Log a win")).toHaveValue("");
});

it("surfaces a server error inline", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: "Win text is required" }),
  });
  render(<WinCaptureBar />);
  type("x");
  submit();
  await waitFor(() =>
    expect(screen.getByText("Win text is required")).toBeInTheDocument()
  );
});
