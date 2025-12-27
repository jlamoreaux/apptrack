// Homepage content constants to avoid duplication and improve maintainability

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