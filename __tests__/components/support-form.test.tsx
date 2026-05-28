/**
 * Tests for SupportForm component
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupportForm } from "@/components/support/support-form";
import { SUPPORT_CATEGORIES } from "@/lib/constants/site-config";

// The shared Select wraps Radix + lucide icons that aren't all mocked in the
// global jest setup; render a lightweight native equivalent so the form itself
// is what's under test.
jest.mock("@/components/ui/select", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    Select: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    SelectTrigger: Passthrough,
    SelectValue: Passthrough,
    SelectContent: Passthrough,
    SelectItem: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockCapture = jest.fn();
jest.mock("@/lib/analytics/posthog", () => ({
  capturePostHogEvent: (...args: unknown[]) => mockCapture(...args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function getSubjectInput() {
  return screen.getByLabelText("Subject") as HTMLInputElement;
}

function getMessageInput() {
  return screen.getByLabelText("Message") as HTMLTextAreaElement;
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /send message/i });
}

function fillValidForm() {
  fireEvent.change(getSubjectInput(), { target: { value: "Cannot retry" } });
  fireEvent.change(getMessageInput(), {
    target: { value: "The retry button does nothing." },
  });
}

describe("SupportForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it("disables submit when subject and message are empty", () => {
    render(<SupportForm source="page" />);
    expect(getSubmitButton()).toBeDisabled();
  });

  it("disables submit when subject is over the length cap", () => {
    render(<SupportForm source="page" />);
    fireEvent.change(getMessageInput(), { target: { value: "valid message" } });
    fireEvent.change(getSubjectInput(), {
      target: { value: "x".repeat(201) },
    });
    expect(getSubmitButton()).toBeDisabled();
  });

  it("disables submit when message is over the length cap", () => {
    render(<SupportForm source="page" />);
    fireEvent.change(getSubjectInput(), { target: { value: "valid subject" } });
    fireEvent.change(getMessageInput(), {
      target: { value: "x".repeat(5001) },
    });
    expect(getSubmitButton()).toBeDisabled();
  });

  it("enables submit when subject and message are valid", () => {
    render(<SupportForm source="page" />);
    fillValidForm();
    expect(getSubmitButton()).toBeEnabled();
  });

  it("fires support_form_opened once on mount with the source", () => {
    render(<SupportForm source="nav" />);
    expect(mockCapture).toHaveBeenCalledWith("support_form_opened", {
      source: "nav",
    });
  });

  it("POSTs the expected payload and calls onDone on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const onDone = jest.fn();

    render(
      <SupportForm
        source="error_fallback"
        initialContext={{ errorMessage: "boom" }}
        onDone={onDone}
      />
    );
    fillValidForm();
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/support",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: SUPPORT_CATEGORIES[0],
          subject: "Cannot retry",
          message: "The retry button does nothing.",
          context: {
            url: window.location.href,
            errorMessage: "boom",
          },
        }),
      })
    );
    expect(mockCapture).toHaveBeenCalledWith("support_request_submitted", {
      category: SUPPORT_CATEGORIES[0],
    });
  });

  it("disables the submit button during an in-flight submit", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<SupportForm source="page" />);
    fillValidForm();
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sending/i })
      ).toBeDisabled();
    });

    resolveFetch?.({ ok: true, status: 200, json: async () => ({}) });
    await waitFor(() => {
      expect(screen.getByText(/your message was sent/i)).toBeInTheDocument();
    });
  });

  it("renders the success state after a successful submit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    render(<SupportForm source="page" />);
    fillValidForm();
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText(/your message was sent/i)).toBeInTheDocument();
    });
  });

  it("renders an inline error and reports failure on a non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many requests" }),
    });

    render(<SupportForm source="page" />);
    fillValidForm();
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/went wrong/i);
    });
    expect(mockCapture).toHaveBeenCalledWith("support_request_failed", {
      reason: "http_429",
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    );
  });

  it("renders an inline error and reports failure on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    render(<SupportForm source="page" />);
    fillValidForm();
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(mockCapture).toHaveBeenCalledWith("support_request_failed", {
      reason: "network_error",
    });
  });
});
