import Link from "next/link"
import { Check } from "lucide-react"
import { NavigationServer } from "@/components/navigation-server"
import { HomepageClientWrapper } from "@/components/homepage-client-wrapper"
import { CareerOtterLogo } from "@/components/careerotter-logo"
import { OrganizationSchema, SoftwareApplicationSchema, FAQSchema } from "@/components/seo/structured-data"

const CASE_COVERAGE_BARS = [
  { label: "Delivery", value: 92, fill: "bg-secondary" },
  { label: "Cross-team", value: 58, fill: "bg-secondary" },
  { label: "Leadership", value: 4, fill: "bg-destructive" },
] as const

const VALUE_PROPS = [
  {
    label: "LAND IT",
    labelColor: "text-primary",
    title: "Get the job",
    description:
      "Unlimited application tracking, free forever. Roast My Resume tells you what's broken before recruiters do.",
  },
  {
    label: "TRACK IT",
    labelColor: "text-secondary",
    title: "Keep the receipts",
    description:
      "Ten-second win logging, comp history, a Friday recap that writes itself. Months of evidence no fresh chatbot session can fake.",
  },
  {
    label: "WIN IT",
    labelColor: "text-primary",
    title: "Get paid for it",
    description:
      "The coach turns your logged wins into a promo case and a review doc — and helps you make the comp ask. Walk in prepared.",
  },
] as const

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Every non-AI tool.",
    features: [
      "Unlimited application tracking",
      "Ten-second win logging",
      "Roast My Resume",
      "Interview notes & contacts",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9",
    cadence: "/month",
    tagline: "Every AI tool. Or $90/year.",
    features: [
      "Everything in Free",
      "AI resume analysis",
      "The coach, grounded in your wins",
      "Promo case & review-doc builder",
      "Comp tracking and the ask",
    ],
    cta: "Start your case",
    highlighted: true,
  },
] as const

const FAQS = [
  {
    question: "I had an AppTrack account — what happens to it?",
    answer:
      "Same account, same data, same login. AppTrack is now CareerOtter; only the name changed.",
  },
  {
    question: "What's the difference between Free and Pro?",
    answer:
      "Free covers every non-AI tool — unlimited tracking, win logging, Roast My Resume, interview notes. Pro ($9/month) unlocks every AI tool: resume analysis, the coach, the case builder, and comp coaching.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. Roast My Resume and your first starter case are free, no card required.",
  },
  {
    question: "How does the coach work?",
    answer:
      "It's grounded only in the wins you log plus your goal and review date — so it names your real gaps and drafts your real case, not generic advice.",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. We don't train on your data, you can export it anytime, and delete means delete.",
  },
  {
    question: "Got the raise or the job?",
    answer:
      "Tell us and we'll pause your subscription — pick it back up when the next review comes around.",
  },
]

export default function HomePage() {
  return (
    <HomepageClientWrapper>
      <OrganizationSchema />
      <SoftwareApplicationSchema />
      <FAQSchema faqs={FAQS} />
      <div className="min-h-screen flex flex-col bg-background">
        <NavigationServer variant="marketing" />
        <main id="main-content" className="flex-1">

        {/* ============================================================
            SECTION 1: HERO
            ============================================================ */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
              {/* Left: Copy */}
              <div className="space-y-6">
                <p className="font-mono text-sm text-secondary">
                  AppTrack is now CareerOtter.
                </p>
                <h1
                  className="font-display font-bold text-foreground leading-[1.05]"
                  style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)", letterSpacing: "-0.02em" }}
                >
                  Build the case for your next raise. Then win it.
                </h1>
                <p className="text-[18px] leading-relaxed text-muted-foreground max-w-[520px]">
                  Log wins in ten seconds. CareerOtter maps them to your review,
                  names the gaps while there&apos;s time to close them, and hands you
                  the doc to walk in with.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link
                    href="/signup"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                  >
                    Start your case
                  </Link>
                  <Link
                    href="/roast-my-resume"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-8 text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                  >
                    Roast my resume
                  </Link>
                </div>
                <p className="font-mono text-sm text-muted-foreground">
                  Two minutes to a real first draft. No credit card.
                </p>
              </div>

              {/* Right: Otter illustration + Case coverage card */}
              <div className="space-y-6">
                <div className="flex justify-center">
                  <CareerOtterLogo
                    decorative
                    width={240}
                    height={136}
                    className="text-foreground"
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-sm text-muted-foreground">
                      Case coverage
                    </span>
                    <span className="font-mono text-3xl font-bold text-primary">
                      60%
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {CASE_COVERAGE_BARS.map((bar) => (
                      <div key={bar.label} className="flex items-center gap-3">
                        <span className="w-[76px] flex-shrink-0 font-mono text-xs text-muted-foreground">
                          {bar.label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                          <div
                            className={`h-full rounded-full ${bar.fill}`}
                            style={{ width: `${bar.value}%` }}
                          />
                        </div>
                        <span className="w-10 flex-shrink-0 text-right font-mono text-xs text-muted-foreground">
                          {bar.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-sm text-muted-foreground">
                    Your case is 60% built. The gap is leadership evidence. Close
                    it before the meeting, not during it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 2: THREE VALUE PROPS
            ============================================================ */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid gap-6 md:grid-cols-3">
              {VALUE_PROPS.map((prop) => (
                <div
                  key={prop.title}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <p
                    className={`font-mono text-xs font-medium tracking-[0.1em] ${prop.labelColor}`}
                  >
                    {prop.label}
                  </p>
                  <h2 className="mt-3 font-display text-xl font-bold text-foreground">
                    {prop.title}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    {prop.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 3: PRICING BAR
            ============================================================ */}
        <section className="border-t border-border py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <p className="font-semibold text-foreground">
                Free covers every non-AI tool. Pro is $9/month for every AI tool.
              </p>
              <p className="text-muted-foreground">
                Got the raise? Tell us and we&apos;ll pause you.
              </p>
              <span className="ml-auto font-mono text-sm text-muted-foreground">
                careerotter.io
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 4: PRICING
            ============================================================ */}
        <section id="pricing" className="py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="font-display text-3xl font-bold text-foreground">Pricing</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex flex-col rounded-xl border bg-card p-6 ${
                    tier.highlighted ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {tier.name}
                    </h3>
                    {tier.highlighted && (
                      <span className="font-mono text-xs text-primary">Most popular</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-bold text-foreground">
                      {tier.price}
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">
                      {tier.cadence}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.tagline}</p>
                  <ul className="mt-5 space-y-2.5">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary"
                          aria-hidden="true"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-md px-6 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background ${
                      tier.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            SECTION 5: FAQ
            ============================================================ */}
        <section className="border-t border-border py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="font-display text-3xl font-bold text-foreground">Questions</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {FAQS.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <h3 className="font-display text-base font-bold text-foreground">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
    </HomepageClientWrapper>
  )
}
