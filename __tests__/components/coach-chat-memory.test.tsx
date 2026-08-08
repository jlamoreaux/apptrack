/**
 * Behavior contract for coach memory restore (coach-chat.tsx).
 *
 * A restored session must keep running its guided flow: when GET returns a
 * stored goalId, the next message the user sends must include that goalId in
 * the POST body. Start-fresh must not clear local state if the DELETE fails.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CoachChat } from "@/components/careerotter/coach-chat";

function mockFetchSequence(handlers: Record<string, (init?: RequestInit) => unknown>) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const key = `${method} ${url}`;
    const body = handlers[key]?.(init);
    if (body === undefined) throw new Error(`Unexpected fetch: ${key}`);
    const { __status, ...json } = body as { __status?: number } & Record<string, unknown>;
    return {
      ok: (__status ?? 200) < 400,
      status: __status ?? 200,
      json: async () => json,
    };
  });
}

describe("CoachChat memory restore", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the restored goalId with the next message", async () => {
    const posts: unknown[] = [];
    const fetchMock = mockFetchSequence({
      "GET /api/careerotter/coach": () => ({
        summary: "You were building your storybank.",
        messages: [
          { role: "user", content: "Turn my wins into interview stories." },
          { role: "assistant", content: "Here is your first story." },
        ],
        goalId: "storybank",
        updatedAt: "2026-08-07T00:00:00Z",
      }),
      "POST /api/careerotter/coach": (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return { reply: "Next story." };
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CoachChat />);
    await screen.findByText("Pick up where you left off");

    fireEvent.change(screen.getByLabelText("Message the coach"), {
      target: { value: "Give me another one" },
    });
    fireEvent.submit(screen.getByLabelText("Message the coach").closest("form")!);

    await waitFor(() => expect(posts.length).toBe(1));
    expect(posts[0]).toMatchObject({ goalId: "storybank" });
  });

  it("keeps the session when start-fresh DELETE fails", async () => {
    const fetchMock = mockFetchSequence({
      "GET /api/careerotter/coach": () => ({
        summary: "You were prepping your review.",
        messages: [{ role: "user", content: "Help me prep." }],
        goalId: null,
        updatedAt: "2026-08-07T00:00:00Z",
      }),
      "DELETE /api/careerotter/coach": () => ({ __status: 500, error: "nope" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<CoachChat />);
    await screen.findByText("Pick up where you left off");

    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));

    await screen.findByText("Could not clear the saved session. Try again.");
    expect(screen.getByText("Help me prep.")).toBeInTheDocument();
  });
});
