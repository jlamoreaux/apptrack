/**
 * Tests for EmailCaptureGate component
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmailCaptureGate } from "@/components/try/email-capture-gate";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("EmailCaptureGate", () => {
  const defaultProps = {
    source: "cover-letter",
    sessionId: "sess_123",
    isProcessing: true,
    onEmailCaptured: jest.fn(),
    onSkip: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("renders spinner when processing", () => {
    render(<EmailCaptureGate {...defaultProps} isProcessing={true} />);
    expect(screen.getByText("Generating your results...")).toBeInTheDocument();
  });

  it("shows 'results ready' when processing is done", () => {
    render(<EmailCaptureGate {...defaultProps} isProcessing={false} />);
    expect(
      screen.getByText(/Your results are ready/)
    ).toBeInTheDocument();
  });

  it("renders email input and submit button", () => {
    render(<EmailCaptureGate {...defaultProps} />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByText("Unlock Full Results")).toBeInTheDocument();
  });

  it("renders skip button", () => {
    render(<EmailCaptureGate {...defaultProps} />);
    expect(screen.getByText("Skip")).toBeInTheDocument();
  });

  it("renders privacy note", () => {
    render(<EmailCaptureGate {...defaultProps} />);
    expect(screen.getByText("No spam. Unsubscribe anytime.")).toBeInTheDocument();
  });

  it("shows validation error for empty email on submit", async () => {
    render(<EmailCaptureGate {...defaultProps} />);

    fireEvent.click(screen.getByText("Unlock Full Results"));

    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid email format on blur", async () => {
    render(<EmailCaptureGate {...defaultProps} />);

    const input = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(input, { target: { value: "notanemail" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeInTheDocument();
    });
  });

  it("calls API and onEmailCaptured on successful submit", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // capture-email
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, analysis: { text: "Full cover letter" } }),
      }); // unlock-with-email

    render(<EmailCaptureGate {...defaultProps} />);

    const input = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(input, { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByText("Unlock Full Results"));

    await waitFor(() => {
      expect(defaultProps.onEmailCaptured).toHaveBeenCalled();
    });

    // Verify capture-email was called
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/try/capture-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", source: "cover-letter", sessionId: "sess_123" }),
      })
    );

    // Verify unlock-with-email was called
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/try/unlock-with-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "sess_123", email: "user@example.com" }),
      })
    );
  });

  it("shows error message when API returns error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Something went wrong" }),
    });

    render(<EmailCaptureGate {...defaultProps} />);

    const input = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(input, { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByText("Unlock Full Results"));

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
    expect(defaultProps.onEmailCaptured).not.toHaveBeenCalled();
  });

  it("calls onSkip when Skip is clicked", () => {
    render(<EmailCaptureGate {...defaultProps} />);
    fireEvent.click(screen.getByText("Skip"));
    expect(defaultProps.onSkip).toHaveBeenCalled();
  });

  it("shows success state after email is captured", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, analysis: {} }),
      });

    render(<EmailCaptureGate {...defaultProps} />);

    const input = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(input, { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByText("Unlock Full Results"));

    await waitFor(() => {
      expect(screen.getByText(/Email saved/)).toBeInTheDocument();
    });
  });
});
