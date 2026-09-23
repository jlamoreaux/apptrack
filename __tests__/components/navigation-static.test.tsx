/**
 * Marketing nav: the Tools menu lists every tool, both the try-without-signing-up
 * ones and the ones behind a free account, and each account tool points at a
 * dashboard page that exists.
 */

import { existsSync } from "fs";
import { join } from "path";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavigationStatic } from "@/components/navigation-static";
import { ACCOUNT_TOOLS, FREE_TOOLS } from "@/lib/constants/free-tools";

// framer-motion's AnimatePresence is fine under jsdom, but the theme hook
// needs no provider to render; it simply reports no theme.
jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));

it("lists every tool, including the comp tracker, in the mobile menu", () => {
  render(<NavigationStatic />);
  fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));

  expect(screen.getByText("Try without signing up")).toBeInTheDocument();
  expect(screen.getByText("Free with an account")).toBeInTheDocument();
  for (const tool of [...FREE_TOOLS, ...ACCOUNT_TOOLS]) {
    expect(screen.getByRole("link", { name: tool.title })).toHaveAttribute("href", tool.href);
  }
  // The comp tracker is usable without an account, so it links to the public page.
  expect(screen.getByRole("link", { name: "Comp Tracker" })).toHaveAttribute("href", "/try/comp");
});

it("points every account tool at a dashboard page that exists", () => {
  for (const tool of ACCOUNT_TOOLS) {
    const segment = tool.href.replace(/^\/dashboard\//, "");
    const page = join(process.cwd(), "app", "(app)", "dashboard", segment, "page.tsx");
    expect({ href: tool.href, exists: existsSync(page) }).toEqual({ href: tool.href, exists: true });
  }
});

it("points every free tool at a marketing page that exists", () => {
  for (const tool of FREE_TOOLS) {
    const page = join(process.cwd(), "app", "(marketing)", tool.href.slice(1), "page.tsx");
    expect({ href: tool.href, exists: existsSync(page) }).toEqual({ href: tool.href, exists: true });
  }
});
