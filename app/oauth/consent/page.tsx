import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConsentScreen } from "@/components/oauth/consent-screen";
import { resolveConsentPage } from "@/lib/auth/oauth/consent-page";
import type { SearchParamValue } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect an app | CareerOtter",
  robots: { index: false, follow: false },
};

/** Where the user approves or denies an app's access (see lib/auth/oauth/consent-page.ts). */
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const resolution = await resolveConsentPage(await searchParams, new Date());
  if (resolution.kind === "not_found") notFound();
  if (resolution.kind === "redirect") redirect(resolution.location);
  return <ConsentScreen view={resolution.view} />;
}
