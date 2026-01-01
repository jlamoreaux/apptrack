import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Free AI Cover Letter Generator | AppTrack",
  description:
    "Generate a professional, personalized cover letter in 30 seconds. Our AI analyzes the job description and your experience to create compelling cover letters that get interviews.",
  keywords: [
    "cover letter generator",
    "AI cover letter",
    "free cover letter",
    "cover letter writer",
    "job application",
    "cover letter template",
    "professional cover letter",
  ],
  openGraph: {
    title: "Free AI Cover Letter Generator | AppTrack",
    description:
      "Generate a professional cover letter in 30 seconds. AI-powered, personalized to each job.",
    url: "https://apptrack.ing/try/cover-letter",
    siteName: "AppTrack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Cover Letter Generator",
    description: "Generate a professional cover letter in 30 seconds with AI.",
  },
  alternates: {
    canonical: "https://apptrack.ing/try/cover-letter",
  },
}

export default function CoverLetterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
