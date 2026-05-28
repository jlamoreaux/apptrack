/**
 * Tests for the AI Coach chat "Retry" button (crash-fix regression guard).
 *
 * The bug: career-advice.tsx destructured `reload` from useChat, but ai@6 /
 * @ai-sdk/react@3 renamed it to `regenerate`, so clicking Retry threw
 * "reload is not a function". These tests mock useChat in the error state and
 * assert Retry re-fires the request via `regenerate` and clears the error.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockRegenerate = jest.fn();
const mockClearError = jest.fn();
const mockSendMessage = jest.fn();
const mockStop = jest.fn();
const mockSetMessages = jest.fn();

const mockUseChatState = {
  messages: [
    {
      id: "user-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Help me with my resume" }],
    },
  ],
  sendMessage: mockSendMessage,
  setMessages: mockSetMessages,
  status: "error" as const,
  error: new Error("Something went wrong"),
  regenerate: mockRegenerate,
  clearError: mockClearError,
  stop: mockStop,
};

jest.mock("@ai-sdk/react", () => ({
  useChat: () => mockUseChatState,
}));

jest.mock("ai", () => ({
  DefaultChatTransport: jest.fn().mockImplementation(() => ({})),
}));

// react-markdown is ESM-only; render its children as plain text for tests.
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockCapturePostHogEvent = jest.fn();
jest.mock("@/lib/analytics/posthog", () => ({
  capturePostHogEvent: (...args: unknown[]) => mockCapturePostHogEvent(...args),
}));

// career-advice.tsx uses icons not covered by the global jest.setup mock.
jest.mock("lucide-react", () => {
  const Icon = () => <span data-testid="icon" />;
  return new Proxy({}, { get: () => Icon });
});

import { CareerAdvice } from "@/components/ai-coach/career-advice";

describe("CareerAdvice retry button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegenerate.mockResolvedValue(undefined);
    // The component fetches conversations on mount; return an empty list.
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ conversations: [] }),
      headers: { get: () => null },
    });
  });

  it("renders a Retry button in the error state", async () => {
    render(<CareerAdvice />);
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("clears the error and re-fires the request via regenerate when Retry is clicked", async () => {
    render(<CareerAdvice />);

    const retryButton = await screen.findByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalledTimes(1);
      expect(mockRegenerate).toHaveBeenCalledTimes(1);
    });
    // Re-fire goes through the SDK, not the manual sendMessage path.
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("captures a success analytics event when the re-fire resolves", async () => {
    render(<CareerAdvice />);

    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(mockCapturePostHogEvent).toHaveBeenCalledWith("ai_chat_retry_clicked", {
        outcome: "success",
      });
    });
  });

  it("captures a failure analytics event when the re-fire rejects", async () => {
    mockRegenerate.mockRejectedValueOnce(new Error("retry failed"));
    render(<CareerAdvice />);

    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(mockCapturePostHogEvent).toHaveBeenCalledWith("ai_chat_retry_clicked", {
        outcome: "failure",
      });
    });
  });
});
