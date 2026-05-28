/**
 * Tests for the shared error-boundary fallback (SupportErrorFallback) rendered
 * via SectionErrorBoundary. Verifies the friendly UI, the support link, the
 * recovery action, and that the boundary-triggered analytics event fires once.
 */

import { render, screen } from "@testing-library/react";
import { SectionErrorBoundary } from "@/components/accessibility/error-boundary";
import { SupportErrorFallback } from "@/components/support/support-error-fallback";

const mockCapture = jest.fn();
jest.mock("@/lib/analytics/posthog", () => ({
  capturePostHogEvent: (...args: unknown[]) => mockCapture(...args),
}));

function Boom(): never {
  throw new Error("kaboom");
}

describe("SupportErrorFallback via SectionErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCapture.mockClear();
    // React logs caught render errors to console.error; silence the expected noise.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders the fallback when a child throws", () => {
    render(
      <SectionErrorBoundary
        name="Test"
        fallback={<SupportErrorFallback name="Test" />}
      >
        <Boom />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows a Contact support link pointing at /dashboard/support", () => {
    render(
      <SectionErrorBoundary
        name="Test"
        fallback={<SupportErrorFallback name="Test" />}
      >
        <Boom />
      </SectionErrorBoundary>
    );

    const supportLink = screen.getByRole("link", { name: /contact support/i });
    expect(supportLink).toHaveAttribute("href", "/dashboard/support");
  });

  it("renders a recovery (try again) button", () => {
    render(
      <SectionErrorBoundary
        name="Test"
        fallback={<SupportErrorFallback name="Test" />}
      >
        <Boom />
      </SectionErrorBoundary>
    );

    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("fires the error_boundary_triggered analytics event once", () => {
    render(
      <SectionErrorBoundary
        name="Test"
        fallback={<SupportErrorFallback name="Test" />}
      >
        <Boom />
      </SectionErrorBoundary>
    );

    const triggeredCalls = mockCapture.mock.calls.filter(
      ([eventName]) => eventName === "error_boundary_triggered"
    );
    expect(triggeredCalls).toHaveLength(1);
    expect(triggeredCalls[0][1]).toEqual(
      expect.objectContaining({ boundary: "Test" })
    );
  });
});
