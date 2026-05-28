/**
 * Tests for the "Help / Contact support" nav entry wiring in UserMenu.
 *
 * The Radix DropdownMenu portals its content, which is unreliable under jsdom,
 * so the menu primitives are mocked to render children inline. SupportDialog is
 * mocked to surface its controlled `open` prop, letting us assert that
 * activating the menu item flips the dialog open.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserMenu } from "@/components/user-menu";
import type { User as SupabaseUser } from "@supabase/supabase-js";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/actions", () => ({
  signOut: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

// The global setup mocks only a fixed allowlist of lucide icons; UserMenu uses
// others (User, Settings, LifeBuoy, ...). Stub any requested icon.
jest.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get: () => () => <span data-testid="icon" />,
    }
  )
);

// Render dropdown primitives inline so the support item is queryable and its
// onSelect handler fires on click without a portal.
jest.mock("@/components/ui/dropdown-menu", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    DropdownMenu: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({
      children,
      onSelect,
      onClick,
    }: {
      children?: ReactNode;
      onSelect?: (event: { preventDefault: () => void }) => void;
      onClick?: () => void;
    }) => (
      <button
        type="button"
        onClick={() => {
          onSelect?.({ preventDefault: () => {} });
          onClick?.();
        }}
      >
        {children}
      </button>
    ),
  };
});

const supportDialogOpenStates: boolean[] = [];
jest.mock("@/components/support/support-dialog", () => ({
  SupportDialog: ({ open }: { open?: boolean }) => {
    supportDialogOpenStates.push(Boolean(open));
    return open ? <div role="dialog">Contact support</div> : null;
  },
}));

const baseUser = { email: "user@example.com" } as SupabaseUser;

beforeEach(() => {
  supportDialogOpenStates.length = 0;
});

describe("UserMenu support entry", () => {
  it("renders the Help / Contact support entry", () => {
    render(
      <UserMenu user={baseUser} profile={null} isOnFreePlan={false} />
    );

    expect(
      screen.getByText("Help / Contact support")
    ).toBeInTheDocument();
  });

  it("opens the support dialog when the entry is activated", () => {
    render(
      <UserMenu user={baseUser} profile={null} isOnFreePlan={false} />
    );

    // Dialog starts closed.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Help / Contact support"));

    expect(screen.getByRole("dialog")).toHaveTextContent("Contact support");
    expect(supportDialogOpenStates).toContain(true);
  });
});
