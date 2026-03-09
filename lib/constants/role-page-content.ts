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
  "frontend-developer": {
    description: "Generate a frontend developer cover letter that highlights your framework expertise, performance wins, and ability to turn designs into polished, accessible UIs.",
    benefits: [
      "Showcases your React, Vue, or Angular depth alongside real project outcomes",
      "Highlights performance improvements with concrete metrics (Lighthouse scores, load times)",
      "Demonstrates accessibility awareness and design-to-code collaboration",
      "Links naturally to your GitHub and portfolio without feeling like a resume dump",
      "ATS-friendly without burying your technical depth",
    ],
    exampleIntro: "Here's how our AI structures a frontend developer cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Frontend Developer role at [Company]. I have four years of experience building production React applications, with a focus on component architecture, performance, and accessible UI patterns.

At [Previous Company], I led a performance initiative that reduced our main bundle size by 40% and improved Lighthouse scores from 58 to 91, directly cutting bounce rate on our landing pages. I collaborated daily with our design team in Figma and worked closely with backend engineers to shape API contracts that made the frontend code cleaner and more predictable.

[Company]'s commitment to [specific product area or engineering value, e.g., fast iteration cycles, design quality] resonates with how I like to work. I would be excited to contribute to [specific feature area or challenge from the job listing].

I would love to share my GitHub and a few case studies from recent projects.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a frontend developer cover letter include?",
        answer: "Name the frameworks and tools you work with daily, then back them up with outcomes. Mention a performance improvement, a tricky accessibility problem you solved, or a design collaboration that went particularly well. Link to your GitHub or a live project.",
      },
      {
        question: "Do frontend developers need a cover letter?",
        answer: "Not always, but a strong one helps when the role is competitive or when you want to explain a career pivot, a gap, or why you are targeting this company specifically. For senior roles, context around your decisions and technical philosophy can tip the scales.",
      },
      {
        question: "Should I mention specific frameworks in my frontend cover letter?",
        answer: "Yes. Name the frameworks you actually know well (React, Vue, Angular, or Svelte) and match them to what is in the job description. Avoid listing everything you have ever touched. Depth in the stack they use matters more than breadth.",
      },
      {
        question: "How long should a frontend developer cover letter be?",
        answer: "3-4 paragraphs, 250-350 words. Developers rarely enjoy writing prose, and hiring managers know it. Be direct, show technical credibility, and let your portfolio do the heavy lifting.",
      },
    ],
  },
  "backend-developer": {
    description: "Generate a backend developer cover letter that communicates your API design skills, database expertise, and ability to build systems that scale reliably.",
    benefits: [
      "Highlights your language and stack depth (Node, Python, Go, Java) in context",
      "Demonstrates system design thinking and scalability experience",
      "Quantifies reliability and performance improvements with real numbers",
      "Shows your approach to databases, caching, and architecture decisions",
      "Passes ATS screening without reading like a system spec",
    ],
    exampleIntro: "Here's how our AI structures a backend developer cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Backend Developer role at [Company]. I have five years of experience building and maintaining RESTful and GraphQL APIs, primarily in Node.js and Python, with PostgreSQL and Redis as my go-to data layer.

At [Previous Company], I redesigned our job processing system from a single-threaded queue to a distributed worker architecture that cut average processing time from 4.2 seconds to 380ms and allowed us to scale throughput 10x without adding infrastructure cost. I also led a database migration from a monolithic Postgres schema to a partitioned design that reduced query times on our highest-traffic endpoints by 65%.

I am drawn to [Company] because [specific technical challenge, product scale, or architecture decision visible in their engineering blog or job listing]. I am particularly interested in [specific area, e.g., their event-driven data pipeline or their move toward microservices].

I would love to discuss how I approach system design problems and walk through a few of the architectural decisions I am most proud of.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a backend developer cover letter include?",
        answer: "Focus on systems you have built or improved, the scale they operated at, and the outcomes. Name the languages, databases, and infrastructure you know well. If you have experience with distributed systems, message queues, or caching layers, say so explicitly.",
      },
      {
        question: "How do I show system design skills in a cover letter?",
        answer: "Describe a specific architecture decision you made and why. Even one sentence like 'I moved our batch jobs from cron to a queue-based system, which improved reliability and gave us retry logic' tells a hiring manager far more than listing 'Redis' on a resume.",
      },
      {
        question: "Should I mention open source contributions in a backend cover letter?",
        answer: "Yes, if they are relevant. A merged PR to a library your target company uses, or a project that demonstrates your approach to API design, is worth a sentence. Link to it. It shows initiative and gives the interviewer something concrete to ask about.",
      },
      {
        question: "How long should a backend developer cover letter be?",
        answer: "3-4 paragraphs, 250-400 words. Be technical but not exhaustive. The goal is to show you think in systems, not to list your entire tech stack.",
      },
    ],
  },
  "full-stack-developer": {
    description: "Generate a full-stack developer cover letter that shows you can own a feature from database schema to deployed UI without needing hand-holding at either end.",
    benefits: [
      "Demonstrates end-to-end ownership across frontend and backend",
      "Highlights independent shipping ability, ideal for startups and lean teams",
      "Shows breadth across the stack while signaling where you go deepest",
      "Adapts naturally for startup vs. enterprise contexts",
      "ATS-optimized without flattening your range into buzzwords",
    ],
    exampleIntro: "Here's how our AI structures a full-stack developer cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Full-Stack Developer role at [Company]. I build across the stack in React and Node.js, with PostgreSQL on the backend and a growing comfort with infrastructure as code. I thrive on small teams where owning a feature from spec to production is the norm rather than the exception.

At [Previous Company], I single-handedly built and shipped a customer-facing reporting dashboard in six weeks, handling the data model, the API layer, and the React frontend. The feature reduced support requests about billing by 30% and became one of our top-cited reasons for renewal in customer interviews. I also integrated a third-party payments provider and wrote the webhook handling that processed over $1.2M in transactions in its first quarter.

[Company]'s stage and approach to product development, specifically [something from their job listing or about page], is exactly the environment I do my best work in. I am excited about the opportunity to [specific challenge or feature area].

I would love to talk about how I approach full-stack problems and share a few projects that show my range.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a full-stack developer cover letter include?",
        answer: "Show that you can own both sides without dropping quality. Mention a project where you built the full feature, name the frontend and backend technologies, and include a specific outcome. Hiring managers for these roles care about independent shipping ability.",
      },
      {
        question: "How do I explain my stack depth as a full-stack developer?",
        answer: "Be honest about where you are strongest. It is fine to say you are a frontend-leaning full-stack developer or that you go deeper on backend systems. Pretending to be equally expert in everything reads as overconfident. Most hiring managers prefer honesty about your center of gravity.",
      },
      {
        question: "Is a full-stack cover letter different for startups vs. enterprise companies?",
        answer: "Yes. For startups, emphasize shipping independently, wearing multiple hats, and moving fast. For enterprise, highlight collaboration with specialized teams, code quality at scale, and experience navigating larger systems. Tailor the framing based on what the company actually needs.",
      },
      {
        question: "How long should a full-stack developer cover letter be?",
        answer: "3-4 paragraphs, 250-400 words. Lead with the type of work you do best and the evidence that you do it well.",
      },
    ],
  },
  "project-manager": {
    description: "Generate a project manager cover letter that leads with your delivery track record, methodology fluency, and ability to keep cross-functional teams aligned under pressure.",
    benefits: [
      "Highlights on-time delivery record and scope management wins",
      "Demonstrates stakeholder communication and executive reporting skills",
      "Shows methodology fluency (Agile, Scrum, Waterfall, or hybrid) without jargon overload",
      "Quantifies impact: budgets managed, teams coordinated, timelines hit",
      "ATS-friendly without turning your delivery record into jargon",
    ],
    exampleIntro: "Here's how our AI structures a project manager cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Project Manager role at [Company]. Over the past six years, I have managed software delivery projects ranging from two-week sprints to 18-month enterprise rollouts, consistently bringing work in on time and within budget across cross-functional teams of up to 40 people.

At [Previous Company], I led the implementation of a new CRM platform across four business units, managing a $1.8M budget and coordinating work across engineering, sales, and customer success. The project shipped two weeks ahead of schedule and came in 8% under budget, which I attribute to early risk identification and a clear change management process that I built from scratch. I also introduced a sprint retrospective format that reduced recurring blockers by 45% within two quarters.

What draws me to [Company] is [specific challenge, scale of work, or how their team operates from the job listing]. I am particularly excited about [specific program, initiative, or product challenge].

I would love to discuss how I approach delivery and how I have handled complex stakeholder environments in the past.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a project manager cover letter include?",
        answer: "Lead with delivery outcomes: timelines hit, budgets managed, team sizes coordinated. Name your methodology (Agile, Scrum, Waterfall, hybrid) and describe a specific project that shows how you handled scope change, stakeholder conflict, or risk. Numbers matter here.",
      },
      {
        question: "Should I mention my PMP or Agile certifications in the cover letter?",
        answer: "Only if they are relevant to the role or required by the job description. A certification is worth one sentence at most. Your track record of delivering projects carries much more weight than a credential.",
      },
      {
        question: "How do I write a PM cover letter when switching industries?",
        answer: "Focus on transferable delivery skills: risk management, stakeholder communication, scope control, and team coordination translate across industries. Pick an example that shows your process clearly and explain why you are interested in this specific industry or company.",
      },
      {
        question: "How long should a project manager cover letter be?",
        answer: "3-4 paragraphs, 300-400 words. Project managers are expected to communicate clearly and concisely. A bloated cover letter is its own red flag.",
      },
    ],
  },
  "business-analyst": {
    description: "Generate a business analyst cover letter that demonstrates your ability to translate messy business problems into clear requirements that engineering teams can actually build.",
    benefits: [
      "Shows your requirements-gathering process and stakeholder interview approach",
      "Highlights experience bridging business and technical teams",
      "Demonstrates data analysis skills alongside process documentation ability",
      "Includes examples of how your work reduced rework or accelerated delivery",
      "Passes ATS screening without losing the analytical voice that sets you apart",
    ],
    exampleIntro: "Here's how our AI structures a business analyst cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Business Analyst role at [Company]. For the past five years I have worked at the intersection of business stakeholders and engineering teams, turning ambiguous requirements into clear specs that teams can build from without constant back-and-forth.

At [Previous Company], I mapped and documented a claims processing workflow that had been undocumented for 11 years. The process mapping exercise surfaced four redundant manual steps that, once automated, saved the ops team roughly 600 hours per year. I facilitated the requirements sessions, wrote the user stories, and stayed involved through UAT to make sure what got built matched what stakeholders actually needed.

I am drawn to [Company] because [specific business challenge, domain, or transformation initiative visible in the job description]. I am particularly interested in [specific area of the business or problem space].

I would love to discuss how I approach requirements discovery and how I keep engineering and business stakeholders aligned through the delivery process.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a business analyst cover letter include?",
        answer: "Describe how you gather requirements, facilitate stakeholder workshops, and document processes. Include a specific example of a problem you defined and the outcome once it was solved. Mention tools you use: SQL, Jira, Confluence, Visio, Tableau, or whatever fits the role.",
      },
      {
        question: "How do I show data analysis skills in a BA cover letter?",
        answer: "Give one specific example: a dashboard you built, a data discrepancy you caught, or an analysis that changed a decision. Mention the tool you used (SQL, Excel, Tableau) and the business impact of the insight.",
      },
      {
        question: "What is the difference between a BA and a PM cover letter?",
        answer: "A BA cover letter emphasizes requirements work, documentation, and analysis. A PM cover letter emphasizes delivery, timelines, and stakeholder management. There is overlap, but BAs should lead with their analytical and discovery skills, not project execution metrics.",
      },
      {
        question: "How long should a business analyst cover letter be?",
        answer: "3-4 paragraphs, 250-400 words. Be precise and structured. A BA whose cover letter is clear and well-organized signals something important about how they work.",
      },
    ],
  },
  "financial-analyst": {
    description: "Generate a financial analyst cover letter that leads with your modeling chops, forecasting accuracy, and ability to present complex data clearly to leadership.",
    benefits: [
      "Highlights Excel and SQL proficiency with specific model types you have built",
      "Demonstrates forecasting and variance analysis experience with real numbers",
      "Shows your ability to translate financial data into executive-ready insights",
      "Signals comfort with FP&A, corporate finance, or investment analysis depending on the role",
      "ATS-optimized without stripping the precision from your language",
    ],
    exampleIntro: "Here's how our AI structures a financial analyst cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Financial Analyst role at [Company]. I have three years of FP&A experience supporting a $120M revenue business, with a focus on monthly forecasting, variance analysis, and building the models that leadership uses to make resourcing decisions.

At [Previous Company], I rebuilt our annual budgeting model from a fragmented spreadsheet process into a consolidated three-statement model that reduced close time by four days per quarter. I also identified a $340K unfavorable variance in our SaaS COGS that had been misclassified for two quarters, corrected it, and implemented a monthly reconciliation process to prevent recurrence. My monthly variance commentary was presented directly to the CFO and board.

[Company]'s scale and the complexity of [specific financial challenge or business unit structure] is exactly the environment where I do my best analytical work. I am excited about the opportunity to [specific challenge from the job description].

I would love to discuss how I build models, how I communicate financial insights to non-finance stakeholders, and what I have learned about forecasting accuracy under uncertainty.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a financial analyst cover letter include?",
        answer: "Name the types of models you build (three-statement, DCF, variance, scenario), the size of the business you have supported, and one specific analytical win with a dollar or efficiency impact. Mention your tools: Excel, SQL, Tableau, Anaplan, or whatever the job requires.",
      },
      {
        question: "Should I mention Excel skills in a financial analyst cover letter?",
        answer: "Yes, and be specific. 'Advanced Excel' is vague. Say you build dynamic three-statement models, use Power Query for data transformation, or write complex array formulas. If you also know SQL or a planning tool like Adaptive or Anaplan, say so.",
      },
      {
        question: "How do I write a financial analyst cover letter for investment banking vs. FP&A?",
        answer: "For investment banking, emphasize valuation work, transaction exposure, attention to detail under pressure, and deal experience. For FP&A, focus on forecasting accuracy, business partnering, and how your analysis influenced decisions. The tone and priorities differ significantly.",
      },
      {
        question: "How long should a financial analyst cover letter be?",
        answer: "3-4 paragraphs, 250-350 words. Be precise and data-driven. A financial analyst whose cover letter is full of vague language and no numbers sends the wrong signal.",
      },
    ],
  },
  "sales-representative": {
    description: "Generate a sales representative cover letter that leads with quota attainment, your prospecting approach, and what you do differently to move deals through the pipeline.",
    benefits: [
      "Leads with quota attainment percentage and deal volume metrics",
      "Highlights prospecting methodology, cold outreach, referrals, or inbound qualification",
      "Shows discovery and consultative selling skills specific to SDR or AE context",
      "Demonstrates pipeline discipline and CRM hygiene",
      "ATS-friendly without dulling the energy that makes you effective",
    ],
    exampleIntro: "Here's how our AI structures a sales representative cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Sales Representative role at [Company]. Over the past two years as an SDR, I have consistently hit or exceeded quota, finishing last year at 118% of target with 94 meetings booked in Q4 alone.

My approach to outreach is research-first. Before I contact a prospect, I understand their business model, their recent news, and the specific problem our product can solve for them. That specificity is why my cold email reply rate is 3x the team average and why I have a 72% show rate on booked meetings. At [Previous Company], I sourced 40% of the pipeline that our AE team closed, generating $1.4M in new ARR in my second year.

I am excited about [Company]'s product because [specific reason tied to the market, customer problem, or competitive angle]. I am particularly drawn to [specific aspect of the role or team from the job listing].

I would love to talk about how I build pipeline and what my process looks like from first touch to booked meeting.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a sales representative cover letter include?",
        answer: "Lead with quota attainment. Include your method (cold calling, email sequencing, social selling), your metrics (meetings booked, reply rates, pipeline sourced), and why you are a fit for this specific company's product and buyer. Make it clear you have done your homework.",
      },
      {
        question: "How do I write a sales cover letter as an SDR vs. an AE?",
        answer: "SDR cover letters should focus on prospecting volume, outreach effectiveness, and meeting booking rates. AE cover letters should lead with closed revenue, average deal size, sales cycle length, and how you build champions and navigate complex deals. Know which role you are applying for and frame accordingly.",
      },
      {
        question: "Should I include my quota attainment percentage in a sales cover letter?",
        answer: "Yes, absolutely. If you hit 110% of quota last year, say so in the first paragraph. If you had a down year, address it briefly and pivot to what you learned. Hiding the number is worse than a dip, because the interviewer will ask anyway.",
      },
      {
        question: "How long should a sales representative cover letter be?",
        answer: "3-4 paragraphs, 250-350 words. Sales cover letters should sell. If yours is boring or generic, that says something about your outreach skills. Make it specific, energetic, and easy to read.",
      },
    ],
  },
  "account-executive": {
    description: "Generate an account executive cover letter that opens with closed ARR, shows how you build champions inside accounts, and demonstrates you can run a full sales cycle.",
    benefits: [
      "Leads with closed ARR and quota attainment in the first paragraph",
      "Demonstrates enterprise or SMB deal experience at the right scale",
      "Shows champion-building, multi-threading, and negotiation skills",
      "Highlights average deal size, sales cycle length, and close rate",
      "Passes ATS screening without softening the results-first voice that closes deals",
    ],
    exampleIntro: "Here's how our AI structures an account executive cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Account Executive role at [Company]. Last year I closed $1.7M in new ARR, finishing at 124% of quota while managing a pipeline of 60-plus mid-market accounts with average deal sizes between $40K and $120K annually.

My approach to winning enterprise deals is multi-threaded from the first discovery call. I identify the economic buyer early, build champions at the VP and director level, and use mutual action plans to keep deals from stalling in legal and procurement. At [Previous Company], I closed four deals over $200K in a single quarter, two of which had been stuck for more than six months before I inherited them. I reopened each with a fresh executive alignment call and a restructured proposal.

[Company]'s product addresses [specific customer pain or market] in a way that I believe has a clear wedge against [competitive dynamic]. I am particularly excited about [specific segment, use case, or go-to-market motion from the job description].

I would love to walk through a few deals that reflect how I manage complex sales cycles from discovery through close.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should an account executive cover letter include?",
        answer: "Open with closed revenue and quota attainment. Include average deal size, sales cycle length, and the market segment you sell into (enterprise, mid-market, or SMB). Describe your sales methodology briefly and give one example of a complex deal you navigated. Tailor the company and product angle heavily.",
      },
      {
        question: "How do I write an AE cover letter for enterprise vs. SMB roles?",
        answer: "Enterprise: emphasize deal complexity, multi-stakeholder navigation, long sales cycles, and large ACV. SMB: emphasize volume, speed, pipeline efficiency, and high-velocity closing. The skills overlap but the framing is very different. Match the tone and metrics to the segment.",
      },
      {
        question: "Should I mention my CRM in an AE cover letter?",
        answer: "Only if it is relevant to the job description or if your CRM hygiene is genuinely a strength. Saying 'I keep my Salesforce pipeline accurate and up-to-date' is more useful than just listing the tool. Show the behavior, not just the software.",
      },
      {
        question: "How long should an account executive cover letter be?",
        answer: "3-4 paragraphs, 300-400 words. AEs are expected to communicate clearly and persuasively. A well-structured cover letter that sells your own candidacy is itself a demonstration of sales skill.",
      },
    ],
  },
  "registered-nurse": {
    description: "Generate a registered nurse cover letter that balances clinical competence with patient-centered care, highlights your specialization, and reflects the demands of your specific unit.",
    benefits: [
      "Highlights clinical setting, specialization (ICU, ER, med-surg, telemetry), and patient acuity",
      "Shows patient outcomes, safety record, and quality improvement contributions",
      "Demonstrates your licensing status, certifications, and continuing education",
      "Conveys compassion and communication skills alongside technical competence",
      "ATS-friendly without losing the patient-centered voice that matters in nursing",
    ],
    exampleIntro: "Here's how our AI structures a registered nurse cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Registered Nurse position in your [Unit/Department] at [Hospital or Facility]. I am a licensed RN with four years of experience in a Level I trauma ER, where I routinely manage high-acuity patients across a broad range of emergent conditions, from cardiac events to polytrauma.

During my time at [Previous Facility], I was part of a rapid response team that reduced code blue events on our unit by 18% over two years through early deterioration identification and protocol-driven escalation. I also helped train six new graduate nurses during onboarding, guiding them through our EMR workflows and our approach to family communication during critical moments. I hold TNCC and BLS certifications and am currently completing my CEN.

What draws me to [Facility] is [specific reason: Magnet status, specialty program, patient population, or values from their mission statement]. I am particularly excited about the opportunity to work in [specific unit or program].

I would welcome the opportunity to speak with you about how my clinical background and approach to patient care align with your team's needs.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a registered nurse cover letter include?",
        answer: "State your specialization and patient population clearly in the first paragraph. Include specific certifications (BLS, ACLS, TNCC, CEN), your unit experience and acuity level, and one example of a clinical contribution or quality improvement initiative. Show compassion but lead with competence.",
      },
      {
        question: "How do I write a nursing cover letter when changing specialties?",
        answer: "Acknowledge the shift directly and frame it as intentional. Highlight the clinical skills that transfer, explain your interest in the new specialty, and mention any coursework, shadowing, or certifications you have pursued to prepare. Nursing managers respect self-awareness and preparation.",
      },
      {
        question: "Should I mention patient ratios or acuity in my nursing cover letter?",
        answer: "Yes. Saying 'I managed a 4:1 patient ratio in a fast-paced telemetry unit' gives the hiring manager immediate context about your workload experience. It helps them assess fit without having to dig through your resume.",
      },
      {
        question: "How long should a registered nurse cover letter be?",
        answer: "3-4 paragraphs, 250-400 words. Be clear and direct. Nursing managers review many applications. A focused letter that shows clinical credibility and genuine interest in the unit goes further than a lengthy one.",
      },
    ],
  },
  "human-resources-manager": {
    description: "Generate an HR manager cover letter that showcases your recruiting results, employee relations experience, and ability to build programs that actually improve retention and culture.",
    benefits: [
      "Highlights recruiting metrics: time-to-fill, offer acceptance rate, source of hire",
      "Shows employee relations experience and how you handle conflict and compliance",
      "Demonstrates HRIS proficiency and people analytics capability",
      "Communicates culture and retention program contributions with real outcomes",
      "Passes ATS screening without turning your people expertise into buzzwords",
    ],
    exampleIntro: "Here's how our AI structures an HR manager cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the HR Manager role at [Company]. I have six years of generalist HR experience across tech and professional services companies, with particular depth in full-cycle recruiting, employee relations, and building the people programs that keep teams engaged through periods of fast growth.

At [Previous Company], I built the recruiting function from scratch during a period when headcount grew from 40 to 140 in 18 months. I reduced average time-to-fill from 67 days to 34, implemented structured interviewing across all departments, and achieved an 88% offer acceptance rate. I also redesigned the onboarding experience, which improved 90-day retention by 22% and was cited as a key factor in our most recent eNPS survey. On the employee relations side, I managed 12 formal investigations in two years with zero escalations to litigation.

What draws me to [Company] is [specific reason: growth stage, values, people-first reputation, or specific program]. I am particularly interested in [specific challenge or opportunity from the job description].

I would love to discuss how I approach building HR programs that are both compliant and genuinely useful to the people they serve.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should an HR manager cover letter include?",
        answer: "Cover your functional depth: recruiting, employee relations, compliance, HRIS, or L&D, and show the scope of what you have managed. Include specific metrics where you can: time-to-fill, retention rates, or headcount supported. Convey that you understand the business, not just HR processes.",
      },
      {
        question: "How do I show culture-building work in an HR cover letter?",
        answer: "Describe a specific program you built or improved and tie it to an outcome. An employee engagement initiative that moved eNPS by 12 points, a mentorship program that improved promotion rates, or a recognition program with measurable participation numbers all tell a concrete story.",
      },
      {
        question: "Should I mention HRIS tools in my HR cover letter?",
        answer: "Yes, if they match what the company uses or if your experience with a major platform (Workday, BambooHR, Rippling, ADP) is a genuine differentiator. Do not lead with the list of tools. Mention it in context of what you accomplished with them.",
      },
      {
        question: "How long should an HR manager cover letter be?",
        answer: "3-4 paragraphs, 300-400 words. HR managers are expected to communicate professionally and concisely. A well-organized cover letter signals that you apply the same care to written communication that you expect from the employees you support.",
      },
    ],
  },
  "teacher": {
    description: "Generate a teacher cover letter that shows your impact on student outcomes, your classroom management approach, and your commitment to differentiated instruction.",
    benefits: [
      "Highlights grade level, subject area, and student population clearly",
      "Shows measurable student outcome improvements where data exists",
      "Demonstrates classroom management philosophy and differentiated instruction approach",
      "Reflects parent communication and community engagement experience",
      "ATS-friendly without reducing your classroom impact to a list of keywords",
    ],
    exampleIntro: "Here's how our AI structures a teacher cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the [Grade/Subject] Teacher position at [School]. I have five years of classroom experience teaching [subject] to [grade level] students in a [urban/suburban/Title I/charter] setting, and I am deeply committed to building classrooms where all students feel seen, challenged, and capable of growth.

At [Previous School], I redesigned my approach to [specific unit or skill area] using project-based learning, which contributed to a 19% improvement in proficiency scores on our end-of-year assessments compared to the prior year. I also built a family communication system using weekly updates and a parent-facing digital portfolio that increased family engagement by 35% as measured by conference attendance and response rates. I differentiate instruction across three reading levels in a single classroom and have mentored two student teachers through their practicum semesters.

What draws me to [School] is [specific reason: mission, community, approach to learning, student population]. I am particularly excited about [specific program, initiative, or grade-level team from the job listing].

I would love to meet your team and discuss how my teaching philosophy and classroom practice would contribute to your school community.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a teacher cover letter include?",
        answer: "Name your subject, grade level, and student population. Include one specific example of improving student outcomes, whether through curriculum redesign, targeted intervention, or a project you are proud of. Mention your classroom management philosophy and any experience with IEPs, differentiation, or co-teaching.",
      },
      {
        question: "How do I write a teacher cover letter for a new school district?",
        answer: "Research the district's values, demographic makeup, and any specific initiatives. Reference them specifically. A cover letter that shows you understand the school's context and community signals that you are applying thoughtfully, not just mass-applying to every open position.",
      },
      {
        question: "Should I mention standardized test scores in a teacher cover letter?",
        answer: "Only if the data reflects genuine improvement and you can provide context. Proficiency gains, growth percentile scores, or comparison to prior cohorts are all useful if you frame them around your instructional decisions, not just the numbers alone.",
      },
      {
        question: "How long should a teacher cover letter be?",
        answer: "3-4 paragraphs, 300-400 words. Teaching requires clear written communication with families and colleagues. A well-written cover letter is its own demonstration of that skill. Avoid jargon and keep the focus on students and your impact.",
      },
    ],
  },
  "graphic-designer": {
    description: "Generate a graphic designer cover letter that leads with your portfolio, communicates your design thinking process, and shows you can translate a creative brief into work clients actually use.",
    benefits: [
      "Leads with portfolio link and the strongest project for this specific role",
      "Shows fluency in Adobe Creative Suite and Figma in context, not just as a list",
      "Demonstrates understanding of brand identity vs. digital vs. print contexts",
      "Highlights client communication and creative brief interpretation skills",
      "ATS-optimized without flattening the personality your portfolio should carry",
    ],
    exampleIntro: "Here's how our AI structures a graphic designer cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Graphic Designer role at [Company]. I am a visual designer with four years of agency experience creating brand identities, digital campaigns, and marketing collateral for clients across [industry or sector]. My portfolio is at [portfoliolink.com] and the brand identity work I did for [relevant client type] reflects the kind of problem-solving I think would be most relevant to your team.

At [Previous Agency/Company], I led the visual rebrand of a regional retail chain, developing a new logo system, typography, and color palette that rolled out across 34 locations, 12 digital channels, and a new packaging line. The client reported a 28% increase in brand recognition in post-launch research. I managed the entire project from creative brief to final delivery, presenting at three client milestone reviews and incorporating feedback without losing the integrity of the original concept.

What draws me to [Company] is [specific reason: their aesthetic, type of clients, internal culture, or specific project or campaign you admire]. I am particularly excited about the opportunity to [specific type of work or creative challenge from the job listing].

I would love to walk you through a few projects and talk about how I approach a creative brief.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a graphic designer cover letter include?",
        answer: "Link to your portfolio in the first paragraph. Name the tools you use daily (Illustrator, Photoshop, InDesign, Figma) in context. Describe one project from brief to delivery, mention the outcome, and explain why you are drawn to this specific company's work or clients.",
      },
      {
        question: "How important is the portfolio link in a graphic designer cover letter?",
        answer: "It is the most important thing in the entire document. Include it prominently, ideally in the first paragraph, and make sure the URL works before you send anything. A broken portfolio link has ended more candidacies than a poorly written cover letter.",
      },
      {
        question: "How do I write a graphic designer cover letter for brand vs. digital roles?",
        answer: "For brand identity roles, emphasize logo systems, typography, color theory, and long-form brand guidelines. For digital roles, highlight web design, UI components, social content, and motion graphics if applicable. Match the framing to what the role actually requires.",
      },
      {
        question: "How long should a graphic designer cover letter be?",
        answer: "3-4 paragraphs, 250-350 words. Keep it tight. The portfolio does the heavy lifting. The cover letter's job is to give context, show personality, and make the hiring manager want to click the link.",
      },
    ],
  },
  "data-scientist": {
    description: "Generate a data scientist cover letter that demonstrates your ML model experience, statistical depth, and ability to translate complex models into measurable business outcomes.",
    benefits: [
      "Highlights your modeling expertise across supervised, unsupervised, and deep learning as relevant",
      "Demonstrates the full pipeline from data wrangling to model deployment",
      "Quantifies business impact of your models with real metrics",
      "Shows Python and SQL depth alongside research and communication skills",
      "Passes ATS screening without reducing your technical depth to a keyword list",
    ],
    exampleIntro: "Here's how our AI structures a data scientist cover letter:",
    exampleBody: `Dear Hiring Manager,

I am applying for the Data Scientist role at [Company]. I have four years of experience building and deploying machine learning models in Python, with a focus on supervised learning for prediction problems and NLP for text classification and extraction.

At [Previous Company], I built a churn prediction model using XGBoost that identified at-risk customers with 84% precision, enabling the customer success team to intervene proactively and reduce monthly churn by 22%. I owned the entire pipeline from feature engineering through model validation to a deployed REST API consumed by our CRM. I also developed an NLP tool that auto-categorized support tickets, reducing manual triage time by 60%.

I am drawn to [Company] because [specific reason: the scale of their ML problem, their data infrastructure, or a specific product feature powered by a model]. I am particularly interested in [specific challenge or area from the job description].

I would love to discuss my modeling approach and walk through a few projects in detail.

Best regards,
[Your Name]`,
    faqs: [
      {
        question: "What should a data scientist cover letter include?",
        answer: "Lead with the types of models you build and the problems they solve. Include a specific project with a measurable business outcome. Name your core tools (Python, SQL, scikit-learn, PyTorch, or TensorFlow) and show that you understand how your work connects to business decisions, not just model performance metrics.",
      },
      {
        question: "How do I show model deployment experience in a data science cover letter?",
        answer: "Mention it explicitly. Describe a model you took from prototype to production, what the deployment looked like (REST API, batch job, real-time scoring), and who consumed it. Many data scientists build models that never ship. Showing end-to-end ownership is a real differentiator.",
      },
      {
        question: "Should I include academic research or publications in a data science cover letter?",
        answer: "Yes, if it is relevant to the role. A published paper or conference presentation that connects to the company's problem space is worth one sentence with a link. Industry roles care more about applied impact than theoretical work, but research credibility matters for senior or research-oriented positions.",
      },
      {
        question: "How long should a data scientist cover letter be?",
        answer: "3-4 paragraphs, 250-400 words. Be specific about technical depth and business impact. Generic language like 'strong analytical skills' adds nothing. One concrete model with a real outcome does more work than three paragraphs of description.",
      },
    ],
  },
}
