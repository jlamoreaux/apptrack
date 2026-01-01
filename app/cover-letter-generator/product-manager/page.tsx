import { Metadata } from "next"
import { RoleLandingPage, generateRoleMetadata } from "@/components/landing/role-landing-page"

const ROLE = "Product Manager"
const ROLE_SLUG = "product-manager"

export const metadata: Metadata = generateRoleMetadata(ROLE, ROLE_SLUG)

const benefits = [
  "Showcases your ability to translate business goals into product strategy",
  "Highlights cross-functional collaboration and stakeholder management",
  "Demonstrates data-driven decision making with metrics",
  "Emphasizes user-centric thinking and customer empathy",
  "Tailored to the specific product domain and company stage",
]

const exampleIntro = "Here's an example of how our AI structures a product manager cover letter:"

const exampleBody = `Dear Hiring Manager,

I am writing to express my interest in the Product Manager position at [Company]. With 5 years of experience driving product strategy for B2B SaaS platforms, I am excited about the opportunity to contribute to [Company's] mission of [company mission].

At [Previous Company], I led the development of a new analytics dashboard that increased user retention by 35% and generated $2M in additional ARR. I achieved this by conducting extensive user research, prioritizing features using a RICE framework, and collaborating closely with engineering and design teams to deliver on tight timelines.

What excites me about [Company] is your focus on [specific product area or challenge]. I believe my experience in [relevant domain] and my track record of shipping products that users love would be valuable as you scale.

I would love to discuss how my product sense and execution skills can help [Company] achieve its next phase of growth.

Best regards,
[Your Name]`

const faqs = [
  {
    question: "What makes a strong product manager cover letter?",
    answer: "A strong PM cover letter demonstrates product sense, data-driven thinking, and leadership skills. Include specific metrics from products you've shipped, examples of cross-functional collaboration, and show that you understand the company's product and market. Avoid generic statements—be specific about your impact.",
  },
  {
    question: "Should I mention technical skills in a PM cover letter?",
    answer: "Yes, briefly mention relevant technical knowledge (SQL, analytics tools, basic coding) but focus more on your ability to work with technical teams and translate between business and engineering. PMs are hired for product sense and leadership, not technical depth.",
  },
  {
    question: "How do I write a PM cover letter without PM experience?",
    answer: "Highlight transferable skills: project management, data analysis, user research, or stakeholder management from other roles. Mention side projects, product teardowns you've written, or PM courses/certifications. Show product sense by demonstrating you understand the company's product deeply.",
  },
  {
    question: "How important is the cover letter for PM roles?",
    answer: "Very important. PM roles require strong communication skills, and your cover letter is a direct demonstration of that ability. It's also your chance to show product sense by explaining why you're interested in their specific product and market.",
  },
]

const relatedRoles = [
  { name: "Technical Product Manager", slug: "technical-product-manager" },
  { name: "Product Owner", slug: "product-owner" },
  { name: "Program Manager", slug: "program-manager" },
  { name: "Business Analyst", slug: "business-analyst" },
  { name: "UX Designer", slug: "ux-designer" },
]

export default function ProductManagerCoverLetterPage() {
  return (
    <RoleLandingPage
      role={ROLE}
      roleSlug={ROLE_SLUG}
      description="Generate a compelling product manager cover letter that showcases your product sense, leadership, and impact."
      benefits={benefits}
      exampleIntro={exampleIntro}
      exampleBody={exampleBody}
      faqs={faqs}
      relatedRoles={relatedRoles}
    />
  )
}
