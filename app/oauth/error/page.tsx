import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AGENT_OAUTH_ERROR_PAGE_REASONS,
  AGENT_OAUTH_ERROR_PAGE_REASON_PARAM,
  isMcpOAuthEnabled,
  type AgentOAuthErrorPageReason,
} from "@/lib/constants/agent-oauth";
import { OAUTH_ERROR_PAGE_COPY } from "@/lib/constants/agent-oauth-ui";
import { APP_ROUTES } from "@/lib/constants/routes";
import type { SearchParamValue } from "@/lib/utils/auth-redirect";

export const metadata: Metadata = {
  title: "Connection problem | CareerOtter",
  robots: { index: false, follow: false },
};

function errorReason(value: SearchParamValue): AgentOAuthErrorPageReason {
  return AGENT_OAUTH_ERROR_PAGE_REASONS.find((reason) => reason === value) ?? "invalid";
}

/**
 * Where the authorization flow sends a request it can't return to the app:
 * an unknown client or unregistered redirect URI, or a lookup that failed.
 */
export default async function OAuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  if (!isMcpOAuthEnabled()) notFound();
  const params = await searchParams;
  const copy = OAUTH_ERROR_PAGE_COPY[errorReason(params[AGENT_OAUTH_ERROR_PAGE_REASON_PARAM])];

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={APP_ROUTES.DASHBOARD.ROOT}>Go to your dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
