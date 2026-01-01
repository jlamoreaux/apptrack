import { Metadata } from "next"
import { RoleLandingPage, generateRoleMetadata } from "@/components/landing/role-landing-page"

const ROLE = "Software Engineer"
const ROLE_SLUG = "software-engineer"

export const metadata: Metadata = generateRoleMetadata(ROLE, ROLE_SLUG)

const benefits = [
  "Highlights technical skills that match the job requirements",
  "Demonstrates problem-solving abilities with concrete examples",
  "Uses industry-standard terminology that passes ATS screening",
  "Balances technical depth with clear communication",
  "Customized for the specific company and tech stack mentioned",
]

const exampleIntro = "Here's an example of how our AI structures a software engineer cover letter:"

const exampleBody = `Dear Hiring Manager,

I am excited to apply for the Software Engineer position at [Company]. With 4 years of experience building scalable web applications using React, Node.js, and PostgreSQL, I am confident I can contribute to your team's mission of [company goal from job description].

In my current role at [Previous Company], I led the development of a microservices architecture that reduced API response times by 40% and improved system reliability to 99.9% uptime. I collaborated closely with product managers and designers to ship features that increased user engagement by 25%.

What draws me to [Company] is your commitment to [specific value or project]. I am particularly excited about the opportunity to work on [specific technology or challenge mentioned in job posting].

I would welcome the opportunity to discuss how my experience with [relevant technologies] can help [Company] achieve its goals.

Best regards,
[Your Name]`

const faqs = [
  {
    question: "What should a software engineer cover letter include?",
    answer: "A strong software engineer cover letter should highlight your technical skills, relevant projects, and measurable achievements. Include specific technologies you've worked with, quantifiable results from your work, and demonstrate your problem-solving abilities. Tailor it to the job description by addressing the specific requirements mentioned.",
  },
  {
    question: "How long should a software engineer cover letter be?",
    answer: "Keep your cover letter to 3-4 paragraphs, typically 250-400 words. Hiring managers and recruiters often review hundreds of applications, so being concise while highlighting your most relevant qualifications is key.",
  },
  {
    question: "Should I include code samples in my cover letter?",
    answer: "No, don't include code in your cover letter. Instead, mention your GitHub profile or portfolio in a brief line. The cover letter should focus on your communication skills and ability to explain technical concepts clearly.",
  },
  {
    question: "How do I write a cover letter for a software engineer job with no experience?",
    answer: "Focus on projects you've built (personal, academic, or bootcamp), technologies you've learned, and transferable skills. Highlight your passion for learning and problem-solving. Include links to your GitHub portfolio showcasing your code quality and project complexity.",
  },
]

// Only link to pages that exist - update as more are added
const relatedRoles = [
  { name: "Product Manager", slug: "product-manager" },
  { name: "Data Analyst", slug: "data-analyst" },
]

export default function SoftwareEngineerCoverLetterPage() {
  return (
    <RoleLandingPage
      role={ROLE}
      roleSlug={ROLE_SLUG}
      description="Create a professional, ATS-friendly cover letter tailored to software engineering positions in 30 seconds."
      benefits={benefits}
      exampleIntro={exampleIntro}
      exampleBody={exampleBody}
      faqs={faqs}
      relatedRoles={relatedRoles}
    />
  )
}
