/**
 * /oauth/error: the invalid-link card by default, the unavailable card for
 * reason=unavailable, a dashboard link, and 404 while OAuth is disabled.
 */

import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import OAuthErrorPage from "@/app/oauth/error/page";
import { OAUTH_ERROR_PAGE_COPY } from "@/lib/constants/agent-oauth-ui";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const savedEnv = { ...process.env };

async function renderPage(params: Record<string, string>): Promise<void> {
  render(await OAuthErrorPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  process.env.CAREEROTTER_ENABLED = "1";
  process.env.CAREEROTTER_MCP_OAUTH_ENABLED = "1";
  delete process.env.VERCEL_ENV;
});

afterAll(() => {
  process.env = savedEnv;
});

describe("OAuth error page", () => {
  it("shows the invalid-link card by default, with a dashboard link", async () => {
    await renderPage({ reason: "anything" });
    expect(screen.getByText(OAUTH_ERROR_PAGE_COPY.invalid.title)).toBeInTheDocument();
    expect(screen.getByText(OAUTH_ERROR_PAGE_COPY.invalid.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("shows the unavailable card", async () => {
    await renderPage({ reason: "unavailable" });
    expect(screen.getByText(OAUTH_ERROR_PAGE_COPY.unavailable.title)).toBeInTheDocument();
  });

  it("404s while OAuth is disabled", async () => {
    delete process.env.CAREEROTTER_MCP_OAUTH_ENABLED;
    await expect(renderPage({})).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
