/**
 * Tests for the roast landing-page instrumentation gap (Task 8.2):
 * roast_file_selected fires when a file is picked on both landing pages.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import RoastLandingV1 from "@/app/(marketing)/roast-my-resume/page";
import RoastLandingV2 from "@/app/(marketing)/roast-my-resume/v2/page";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrackEvent = jest.fn();
jest.mock("@/lib/roast/analytics", () => ({
  ...jest.requireActual("@/lib/roast/analytics"),
  useRoastAnalytics: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock("posthog-js/react", () => ({
  usePostHog: () => null,
}));

jest.mock("lucide-react", () => ({
  Flame: () => <div data-testid="flame-icon" />,
  Loader2: () => <div data-testid="loader2-icon" />,
}));

jest.mock("@/components/roast/roasting-animation-lazy", () => ({
  RoastingAnimationLazy: () => null,
}));

jest.mock("@/components/navigation-static", () => ({
  NavigationStatic: () => null,
}));

jest.mock("@/components/ui/file-upload", () => ({
  FileUpload: ({ onFileSelect }: { onFileSelect: (file: File) => void }) => (
    <button
      type="button"
      onClick={() =>
        onFileSelect(
          new File(["resume"], "resume.pdf", { type: "application/pdf" })
        )
      }
    >
      mock-select-file
    </button>
  ),
}));

describe.each([
  ["v1", RoastLandingV1],
  ["v2", RoastLandingV2],
])("roast-my-resume landing page %s", (_variant, Page) => {
  it("fires roast_file_selected when a file is picked", () => {
    render(<Page />);

    fireEvent.click(screen.getByText("mock-select-file"));

    expect(mockTrackEvent).toHaveBeenCalledWith("roast_file_selected", {
      fileType: "application/pdf",
      fileSize: expect.any(Number),
    });
  });
});
