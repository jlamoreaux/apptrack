import { Metadata } from "next"
import { RoleLandingPage, generateRoleMetadata } from "@/components/landing/role-landing-page"

const ROLE = "Data Analyst"
const ROLE_SLUG = "data-analyst"

export const metadata: Metadata = generateRoleMetadata(ROLE, ROLE_SLUG)

const benefits = [
  "Highlights your analytical skills and tools proficiency (SQL, Python, Tableau)",
  "Demonstrates business impact through data-driven insights",
  "Showcases your ability to communicate complex findings to stakeholders",
  "Emphasizes problem-solving and attention to detail",
  "Tailored to the specific industry and data challenges mentioned",
]

const exampleIntro = "Here's an example of how our AI structures a data analyst cover letter:"

const exampleBody = `Dear Hiring Manager,

I am excited to apply for the Data Analyst position at [Company]. With 3 years of experience transforming complex datasets into actionable business insights, I am eager to contribute to [Company's] data-driven decision making.

In my current role at [Previous Company], I developed automated dashboards using Tableau and SQL that reduced weekly reporting time by 60% and enabled real-time monitoring of key KPIs. My analysis of customer churn patterns led to recommendations that improved retention by 18%, saving an estimated $500K annually.

I am particularly drawn to [Company] because of your commitment to [specific data initiative or challenge]. My experience with [relevant tools/techniques] and my ability to translate data into clear recommendations would allow me to make an immediate impact on your team.

I would welcome the opportunity to discuss how my analytical skills and business acumen can help [Company] leverage data for growth.

Best regards,
[Your Name]`

const faqs = [
  {
    question: "What skills should I highlight in a data analyst cover letter?",
    answer: "Highlight both technical skills (SQL, Python/R, visualization tools like Tableau or Power BI) and soft skills (communication, problem-solving, business acumen). Include specific examples of how your analysis led to business decisions or measurable outcomes.",
  },
  {
    question: "How do I show business impact as a data analyst?",
    answer: "Quantify your impact whenever possible: 'My analysis led to a 15% increase in conversion' or 'Automated reporting saved 10 hours per week.' Show that you understand data analysis is a means to business outcomes, not an end in itself.",
  },
  {
    question: "Should I include my technical certifications?",
    answer: "Briefly mention relevant certifications (Google Data Analytics, Tableau Desktop Specialist) in your cover letter if they're listed in the job requirements. However, focus more on demonstrating your skills through examples rather than listing credentials.",
  },
  {
    question: "How do I stand out from other data analyst applicants?",
    answer: "Go beyond listing tools—show how you've used them to solve real problems. Demonstrate curiosity by mentioning what interests you about the company's data challenges. If possible, reference a specific insight you noticed about their business or industry.",
  },
]

// Only link to pages that exist - update as more are added
const relatedRoles = [
  { name: "Software Engineer", slug: "software-engineer" },
  { name: "Product Manager", slug: "product-manager" },
]

export default function DataAnalystCoverLetterPage() {
  return (
    <RoleLandingPage
      role={ROLE}
      roleSlug={ROLE_SLUG}
      description="Create a data analyst cover letter that showcases your analytical skills and business impact in 30 seconds."
      benefits={benefits}
      exampleIntro={exampleIntro}
      exampleBody={exampleBody}
      faqs={faqs}
      relatedRoles={relatedRoles}
    />
  )
}
