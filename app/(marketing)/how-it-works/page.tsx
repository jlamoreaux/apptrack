import type { Metadata } from "next";
import Link from "next/link";
import { NavigationStatic } from "@/components/navigation-static";
import { SITE_CONFIG } from "@/lib/constants/site-config";
import { HELP_SECTIONS } from "@/lib/constants/help-content";

const canonicalUrl = `${SITE_CONFIG.url}/how-it-works`;

export const metadata: Metadata = {
  title: `How CareerOtter works | ${SITE_CONFIG.name}`,
  description:
    "Log wins, tag them by area, watch coverage, and walk into your review with a case. What each part does, how coverage is scored, and what the AI will and will not do.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "How CareerOtter works",
    description: "Log wins, tag them, watch coverage, walk in with a case.",
    url: canonicalUrl,
    siteName: SITE_CONFIG.name,
    type: "website",
  },
};

/**
 * The one help page. Questions that span pages live here; anything specific to
 * one page is answered on that page. Server-rendered with native disclosures,
 * so it needs no client JavaScript and every answer is in the HTML for search.
 */
export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <div className="mb-10 space-y-2">
          <h1 className="text-3xl font-bold sm:text-4xl">How CareerOtter works</h1>
          <p className="text-muted-foreground">
            Log what you ship. Tag it. Watch coverage. Walk into your review with a
            case instead of a memory. The details, in the order you will meet them.
          </p>
        </div>

        <nav aria-label="Sections" className="mb-10">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {HELP_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-primary hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          {HELP_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.intro}</p>
                {section.link && (
                  <Link
                    href={section.link.href}
                    className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
                  >
                    {section.link.label}
                  </Link>
                )}
              </div>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-lg border bg-card open:bg-muted/30"
                  >
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                      {item.question}
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground transition-transform group-open:rotate-180"
                      >
                        ⌄
                      </span>
                    </summary>
                    <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 space-y-2 border-t pt-8 text-sm text-muted-foreground">
          <p>
            Something not answered here? Use Help / Contact support from your account
            menu. It goes to a person.
          </p>
          <p>
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to Today
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
