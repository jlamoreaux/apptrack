/**
 * Case builder: says what it produces before the first click, and when the log
 * is too thin it points at the wins page instead of leaving a dead end.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CaseBuilder } from "@/components/careerotter/case-builder";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => mockFetch.mockReset());

it("explains what the document will be before anything is generated", () => {
  render(<CaseBuilder />);
  expect(screen.getByText("What you will get")).toBeInTheDocument();
  expect(screen.getByText(/Nothing is invented/)).toBeInTheDocument();
});

it("links to the wins page when the API says there are too few wins", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: "Log at least 3 wins first.", needsMoreWins: true }),
  });
  render(<CaseBuilder />);
  fireEvent.click(screen.getByRole("button", { name: /build my case/i }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Log at least 3 wins/));
  expect(screen.getByRole("link", { name: "Log wins" })).toHaveAttribute("href", "/dashboard/wins");
});

it("replaces the explainer with the document once generated", async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ markdown: "# My case" }) });
  render(<CaseBuilder />);
  fireEvent.click(screen.getByRole("button", { name: /build my case/i }));
  await waitFor(() => expect(screen.getByText("# My case")).toBeInTheDocument());
  expect(screen.queryByText("What you will get")).not.toBeInTheDocument();
});
