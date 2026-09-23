import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AGENT_ACCESS_SIGN_IN_HREF,
  AGENT_SCOPE_DETAILS,
  AGENT_TOKEN_NEVER_LABEL,
} from "@/lib/constants/agent-access-ui";
import type { AgentTokenScope } from "@/lib/constants/agent-access";
import type { ApiFailure, ApiFailureReason } from "@/lib/client/agent-api.client";
import { formatLocalDate } from "@/lib/utils/date";

// Token and app names are user- or client-supplied and may be one unbroken
// string. overflow-wrap "anywhere" also lowers the min-content width, which
// grid and flex parents size from, so a long name wraps instead of forcing
// horizontal scroll.
export const LONG_TEXT_WRAP = "min-w-0 break-words [overflow-wrap:anywhere]";

/** A date, or "Never" for a null last-used or expiry date. */
export function formatOptionalDate(value: string | null): string {
  return value === null ? AGENT_TOKEN_NEVER_LABEL : formatLocalDate(value);
}

export function scopeLabels(scopes: readonly AgentTokenScope[]): string {
  return scopes.map((scope) => AGENT_SCOPE_DETAILS[scope].label).join(", ");
}

/** One term and value in a token's or app's detail list. */
export function AgentDetail({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Enough of an API failure (or a client-side validation message) to render. */
export interface AgentAccessErrorDetail {
  message: string;
  reason?: ApiFailureReason;
}

/**
 * Inline error for the Connected agents UI. An expired session gets a sign-in
 * link that returns the user to this page.
 */
export function AgentAccessError({
  id,
  failure,
}: {
  id?: string;
  failure: AgentAccessErrorDetail;
}): React.JSX.Element {
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {failure.message}
      {failure.reason === "unauthorized" && (
        <>
          {" "}
          <Link
            href={AGENT_ACCESS_SIGN_IN_HREF}
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            Sign in again.
          </Link>
        </>
      )}
    </p>
  );
}

/**
 * A list that failed to load: the error, and Try again unless the session
 * expired (retrying can't help; the error links to sign-in instead).
 */
export function LoadFailure({
  failure,
  onRetry,
}: {
  failure: ApiFailure;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <AgentAccessError failure={failure} />
      {failure.reason !== "unauthorized" && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Section heading that can receive focus programmatically (tabIndex -1), so
 * focus has somewhere meaningful to land when the content it followed is
 * replaced or removed.
 */
export function AgentSectionHeading({
  id,
  ref,
  children,
}: {
  id: string;
  ref?: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h3 id={id} ref={ref} tabIndex={-1} className="text-base font-semibold">
      {children}
    </h3>
  );
}
