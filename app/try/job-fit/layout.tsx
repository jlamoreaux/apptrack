import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free Job Fit Analysis | Check Resume Match | AppTrack",
  description:
    "Instantly analyze how well your resume matches a job description. Get an AI-powered fit score, identify missing keywords, and receive actionable suggestions to improve your application.",
  keywords: [
    "job fit analysis",
    "resume match",
    "ATS checker",
    "resume keywords",
    "job match score",
    "resume analyzer",
    "job application tips",
  ],
  openGraph: {
    title: "Free Job Fit Analysis | AppTrack",
    description:
      "Check how well your resume matches a job. Get fit score and improvement tips.",
    url: "https://apptrack.ing/try/job-fit",
    siteName: "AppTrack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Job Fit Analysis",
    description: "Check how well your resume matches a job description.",
  },
  alternates: {
    canonical: "https://apptrack.ing/try/job-fit",
  },
}

export default function JobFitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
