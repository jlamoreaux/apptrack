import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free AI Interview Questions Generator | CareerOtter",
  description:
    "Get personalized interview questions based on the job description and your experience. Prepare for behavioral, technical, and role-specific questions with AI-generated practice prompts.",
  keywords: [
    "interview questions",
    "interview prep",
    "job interview practice",
    "behavioral questions",
    "technical interview",
    "interview preparation",
    "mock interview",
  ],
  openGraph: {
    title: "Free AI Interview Questions Generator | CareerOtter",
    description:
      "Get personalized interview questions for any job. Practice with AI-generated prompts.",
    url: "https://careerotter.io/try/interview-prep",
    siteName: "CareerOtter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Interview Questions Generator",
    description: "Get personalized interview questions for any job.",
  },
  alternates: {
    canonical: "https://careerotter.io/try/interview-prep",
  },
}

export default function InterviewPrepLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
