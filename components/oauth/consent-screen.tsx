import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DATA_PAGE_PATH } from "@/lib/constants/agent-access-ui";
import { AGENT_OAUTH_LIMITS } from "@/lib/constants/agent-oauth";
import { OAUTH_CONSENT_COPY } from "@/lib/constants/agent-oauth-ui";
import type { AgentOAuthConsentView } from "@/types";
import { ConsentForm } from "./consent-form";
import { ConsentSignOutButton } from "./consent-sign-out-button";

const LINK_CLASS = "inline-flex min-h-11 items-center font-medium underline underline-offset-4";

/**
 * The consent screen: which app is asking (its name in <bdi>, so a
 * right-to-left name can't reorder the heading), the unverified notice,
 * where it sends the user back, who is signed in, and the decision form. At the
 * connected-app cap (with no grant for this app to replace) there is no
 * Approve button, only a way to manage connected apps or deny.
 */
export function ConsentScreen({ view }: { view: AgentOAuthConsentView }): React.JSX.Element {
  const canApprove = !view.atCap;
  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle asChild className="break-words text-xl leading-snug">
            <h1>
              <bdi>{view.clientName}</bdi> {OAUTH_CONSENT_COPY.headingAfterName}
            </h1>
          </CardTitle>
          <CardDescription>{OAUTH_CONSENT_COPY.unverified}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {OAUTH_CONSENT_COPY.returnTo}{" "}
            <strong className="break-all text-base font-semibold">{view.returnDestination}</strong>
          </p>

          {view.clientUri !== null && (
            <p className="text-sm text-muted-foreground">
              {OAUTH_CONSENT_COPY.clientUri}{" "}
              <a href={view.clientUri} target="_blank" rel="noopener noreferrer nofollow" className={`${LINK_CLASS} break-all`}>
                {view.clientUri}
              </a>
            </p>
          )}

          <div className="text-sm text-muted-foreground">
            {view.email !== null && (
              <>
                {OAUTH_CONSENT_COPY.signedInAs}{" "}
                <strong className="break-all text-foreground">{view.email}</strong>.{" "}
              </>
            )}
            {OAUTH_CONSENT_COPY.notYou}
            <ConsentSignOutButton consentPath={view.consentPath} />
          </div>

          {view.hasActiveGrant && <p className="text-sm">{OAUTH_CONSENT_COPY.replacesAccess}</p>}

          {!canApprove && (
            <div role="status" className="space-y-1 text-sm">
              <p>{OAUTH_CONSENT_COPY.atCap(AGENT_OAUTH_LIMITS.maxActiveGrantsPerUser)}</p>
              <Link href={DATA_PAGE_PATH} className={LINK_CLASS}>
                {OAUTH_CONSENT_COPY.manageApps}
              </Link>
            </div>
          )}

          <ConsentForm
            requestParams={view.requestParams}
            requestedScopes={view.requestedScopes}
            userId={view.userId}
            consentPath={view.consentPath}
            canApprove={canApprove}
          />

          <p className="border-t pt-4 text-sm text-muted-foreground">{OAUTH_CONSENT_COPY.noAccount}</p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
