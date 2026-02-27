/**
 * Content for role-specific cover letter landing pages.
 * Roles without an entry here get auto-generated content from generateRoleContent().
 */

export interface RolePageContent {
  description: string
  benefits: string[]
  exampleIntro: string
  exampleBody: string
  faqs: Array<{ question: string; answer: string }>
}

/**
 * Generate sensible default content for any role.
 * Used when a role doesn't have hand-crafted content.
 */
export function generateRoleContent(role: string): RolePageContent {
  const roleLower = role.toLowerCase()
  const roleArticle = /^[aeiou]/i.test(role) ? "an" : "a"

  return {
    description: `Create a professional, ATS-friendly cover letter tailored to ${roleLower} positions in 30 seconds.`,
    benefits: [
      `Highlights the skills and experience that matter most for ${roleLower} roles`,
      "Uses keywords from the job description to pass ATS screening",
      "Demonstrates your value with specific, relevant examples",
      "Professional tone that's direct and easy to read",
      "Tailored to the company and position — not a generic template",
    ],
    exampleIntro: `Here's how our AI structures ${roleArticle} ${roleLower} cover letter:`,
    exampleBody: `Dear Hiring Manager,

I am excited to apply for the ${role} position at [Company]. With [X] years of experience in [relevant area], I am confident I can contribute meaningfully to your team's goals.

In my previous role at [Previous Company], I [specific accomplishment with measurable result]. I worked closely with [relevant stakeholders] to [outcome that aligns with the target role].

What draws me to [Company] is [specific reason — mission, product, team, or challenge]. I am particularly excited about the opportunity to [something specific from the job description].

I would welcome the chance to discuss how my background in [relevant skills] can help [Company] achieve its objectives.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: `What should a ${roleLower} cover letter include?`,
        answer: `A strong ${roleLower} cover letter should highlight your most relevant experience, key accomplishments with measurable results, and specific skills that match the job description. Tailor each letter to the company and role — avoid generic templates that could apply to any job.`,
      },
      {
        question: `How long should a ${roleLower} cover letter be?`,
        answer: `Keep it to 3-4 paragraphs, roughly 250-400 words. Hiring managers review a lot of applications — being concise while demonstrating clear value is more effective than length.`,
      },
      {
        question: `How do I write a ${roleLower} cover letter with no experience?`,
        answer: `Focus on transferable skills, relevant coursework or projects, and your genuine enthusiasm for the role. Show that you understand what the job requires and explain how your background — even if non-traditional — prepares you to do it well.`,
      },
      {
        question: "Does a cover letter actually matter?",
        answer: `Yes, especially for competitive roles. A well-written cover letter lets you explain things your resume can't — why you're making a move, what draws you to this specific company, and how your background connects to their needs. It's often the difference between a callback and silence.`,
      },
    ],
  }
}

/** Role-specific overrides for top-traffic roles */
export const ROLE_CONTENT_OVERRIDES: Partial<Record<string, RolePageContent>> = {
  "ux-designer": {
    description: "Generate a professional UX designer cover letter that showcases your design process, user research skills, and portfolio in 30 seconds.",
    benefits: [
      "Highlights your design process and user-centered thinking",
      "Communicates the impact of your work with metrics and outcomes",
      "Demonstrates cross-functional collaboration with engineers and PMs",
      "ATS-friendly without sounding robotic",
      "Tailored to the company's product and design philosophy",
    ],
    exampleIntro: "Here's how our AI frames a UX designer cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the UX Designer role at [Company]. With 3 years of experience designing consumer-facing products, I bring a research-driven approach that connects user needs to business outcomes.

At [Previous Company], I led a redesign of the onboarding flow that increased activation by 34% and reduced support tickets by 20%. I worked closely with engineers and product managers to ship iterative improvements based on usability testing and behavioral data.

I am drawn to [Company] because of your focus on [specific design challenge or product]. I am particularly excited about the opportunity to work on [specific area] and contribute to a team that values [specific thing from their careers page or product].

I would love to walk you through my portfolio and discuss how I approach design problems.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a UX designer cover letter include?",
        answer: "Mention specific projects, your design process, tools you use (Figma, research methods), and measurable outcomes. Link to your portfolio — it's the most important thing a UX hiring manager will look at.",
      },
      {
        question: "Should I attach my portfolio to my cover letter?",
        answer: "Include a link to your portfolio in the cover letter itself rather than attaching files. Keep it prominent — UX roles are portfolio-driven and hiring managers will want to see your work before anything else.",
      },
      {
        question: "How long should a UX designer cover letter be?",
        answer: "3-4 paragraphs, 250-350 words. Focus on one or two projects that are most relevant to the role rather than trying to summarize your entire career.",
      },
      {
        question: "How do I write a UX cover letter for my first job?",
        answer: "Lead with projects — bootcamp work, personal projects, freelance, or redesign case studies all count. Describe your process, what problem you were solving, and what you learned. Passion and a clear thought process matter more than years of experience at this stage.",
      },
    ],
  },
  "marketing-manager": {
    description: "Generate a marketing manager cover letter that leads with results, channels you've owned, and the campaigns that actually moved the needle.",
    benefits: [
      "Leads with metrics — CAC, ROAS, email open rates, pipeline generated",
      "Shows channel expertise relevant to the job description",
      "Demonstrates strategic thinking alongside execution ability",
      "ATS-optimized without losing your voice",
      "Tailored to the company's current marketing approach",
    ],
    exampleIntro: "Here's how our AI structures a marketing manager cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Marketing Manager position at [Company]. Over the past four years, I have built and scaled demand generation programs that generated over $2M in pipeline annually across paid, content, and email channels.

At [Previous Company], I owned the full-funnel marketing strategy for a B2B SaaS product, growing MQLs by 60% year-over-year while reducing cost per lead by 25%. I managed a team of three and worked closely with sales to align on ICP targeting and conversion metrics.

[Company]'s focus on [specific go-to-market motion or channel] is exactly where I want to go deeper. I am particularly excited about [specific campaign, product launch, or growth challenge from their recent news].

I would love to talk through how I can help [Company] hit its pipeline and revenue goals.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a marketing manager cover letter include?",
        answer: "Lead with results — specific metrics like pipeline generated, conversion rates, CAC reduction, or revenue impact. Name the channels you've owned and the scale you've worked at. Tailor heavily to the company's current marketing motion.",
      },
      {
        question: "How do I write a cover letter for a marketing manager role without direct management experience?",
        answer: "Focus on scope and impact. If you haven't managed a team, highlight projects where you led cross-functional work, mentored junior marketers, or owned a significant program independently. Management experience helps but isn't always required.",
      },
      {
        question: "Should I include campaign metrics in my marketing cover letter?",
        answer: "Yes, absolutely. Specific numbers (ROAS, open rates, pipeline, lead volume) do more work than any adjective. Even rough estimates are better than vague language like 'drove significant growth.'",
      },
      {
        question: "How long should a marketing manager cover letter be?",
        answer: "3-4 paragraphs, 250-400 words. Marketing hiring managers can spot filler quickly — keep every sentence earning its place.",
      },
    ],
  },
}
