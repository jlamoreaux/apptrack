import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume Roast - Get Brutally Honest AI Feedback | AppTrack",
  description: "Upload your resume and get hilariously savage (but honest) feedback from our AI roaster. Find out what recruiters really think. Free, private, and shareable!",
  keywords: [
    "resume review",
    "resume feedback",
    "AI resume analysis",
    "resume roast",
    "career advice",
    "job search",
    "resume critique",
    "funny resume feedback",
  ],
  openGraph: {
    title: "Resume Roast - Get Brutally Honest AI Feedback",
    description: "Upload your resume and get hilariously savage feedback. Find out what recruiters really think!",
    url: "https://apptrack.ing/roast-my-resume",
    siteName: "AppTrack",
    type: "website",
    images: [
      {
        url: "https://apptrack.ing/roast-my-resume/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Resume Roast - Get Brutally Honest AI Feedback",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resume Roast - Get Brutally Honest AI Feedback",
    description: "Upload your resume and get hilariously savage feedback. Find out what recruiters really think!",
    images: ["https://apptrack.ing/roast-my-resume/opengraph-image"],
    creator: "@apptrack",
  },
  alternates: {
    canonical: "https://apptrack.ing/roast-my-resume",
  },
};

export default function RoastMyResumeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}