import { Metadata } from "next";
import { NavigationStatic } from "@/components/navigation-static";

export const metadata: Metadata = {
  title: "Try AI Tools Free | CareerOtter",
  description:
    "Try our AI-powered job search tools with one free trial daily. Get job fit analysis, cover letter generation, and interview prep questions instantly.",
  keywords: [
    "job fit analysis",
    "cover letter generator",
    "interview prep",
    "AI job tools",
    "career tools",
    "job search",
    "resume analysis",
  ],
  openGraph: {
    title: "Try AI Job Search Tools Free | CareerOtter",
    description:
      "Try our AI-powered job search tools with one free trial daily. Get instant insights.",
    url: "https://careerotter.io/try",
    siteName: "CareerOtter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Try AI Job Search Tools Free | CareerOtter",
    description:
      "Try our AI-powered job search tools with one free trial daily.",
  },
};

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      {children}
    </div>
  );
}
