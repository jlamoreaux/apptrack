import type { Faq, PricingTier } from "@/types"

// Homepage content constants to avoid duplication and improve maintainability

export const IMAGE_SIZES = "(min-width: 1024px) 50vw, 100vw"
export const IMAGE_SIZES_SMALL = "(min-width: 1024px) 384px, 100vw"
export const IMAGE_QUALITY = 75
export const IMAGE_QUALITY_HERO = 80

export const SCREENSHOT_STYLES = {
  background: 'transparent',
  isolation: 'isolate'
} as const

export const SANKEY_FEATURES = [
  "See conversion rates at each stage",
  "Identify bottlenecks in your process",
  "Track progress over time"
]

export const INTERVIEW_PREP_FEATURES = [
  "Custom questions for each role",
  "STAR format answer suggestions",
  "Company-specific preparation",
  "Questions to ask the interviewer"
]

export const MOBILE_FEATURES = [
  "Fully responsive design",
  "Quick status updates on mobile",
  "Access notes before interviews"
]

export const FEATURE_SECTIONS = {
  sankey: {
    title: "Visualize Your Pipeline",
    description: "Track how your applications flow through each stage with our unique Sankey chart visualization. See exactly where applications succeed or drop off in your job search pipeline.",
    features: SANKEY_FEATURES
  },
  interviewPrep: {
    title: "AI-Powered Interview Preparation",
    description: "Get personalized interview questions and talking points based on the actual job description. Walk into every interview confident and prepared.",
    features: INTERVIEW_PREP_FEATURES
  },
  mobile: {
    title: "Track Applications On The Go",
    description: "Your job search doesn't stop when you leave your desk. Access all your applications, update statuses, and check interview details from any device.",
    features: MOBILE_FEATURES
  }
} as const

// Pricing + FAQ copy lives here (not in the page) so the homepage and the
// agent-facing markdown rendering of it can't drift apart.
export const PRICING_TIERS = [
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
] as const satisfies readonly PricingTier[]

export const FAQS = [
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
] satisfies Faq[]
