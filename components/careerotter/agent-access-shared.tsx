import Link from "next/link";
import { AGENT_ACCESS_SIGN_IN_HREF } from "@/lib/constants/agent-access-ui";
import type { ApiFailureReason } from "@/lib/client/agent-tokens.client";

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
