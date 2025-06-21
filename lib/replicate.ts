import Replicate from "replicate"

if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error("REPLICATE_API_TOKEN is not set")
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface CareerCoachOptions {
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}

export async function callCareerCoach({
  messages,
  maxTokens = 1000,
  temperature = 0.7,
}: CareerCoachOptions): Promise<string> {
  try {
    // Format messages for Claude
    const systemMessage =
      messages.find((m) => m.role === "system")?.content ||
      "You are a professional career coach specializing in job applications, interviews, and career development. Provide helpful, actionable advice."

    const conversationMessages = messages.filter((m) => m.role !== "system")

    // Build the prompt for Claude
    let prompt = `${systemMessage}\n\nConversation:\n`

    conversationMessages.forEach((message) => {
      const role = message.role === "user" ? "Human" : "Assistant"
      prompt += `${role}: ${message.content}\n`
    })

    prompt += "Assistant:"

    const output = await replicate.run("anthropic/claude-3-5-sonnet:latest", {
      input: {
        prompt,
        max_tokens: maxTokens,
        temperature,
      },
    })

    // Handle the response - Replicate returns an array of strings
    if (Array.isArray(output)) {
      return output.join("")
    }

    return String(output)
  } catch (error) {
    console.error("Error calling Replicate Claude API:", error)
    throw new Error("Failed to get career coaching response")
  }
}

export async function generateResumeAdvice(resumeText: string, jobDescription?: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are an expert resume reviewer and career coach. Analyze resumes and provide specific, actionable feedback to improve them for job applications.",
    },
    {
      role: "user",
      content: jobDescription
        ? `Please review my resume and provide feedback on how to better align it with this job description:\n\nJob Description:\n${jobDescription}\n\nMy Resume:\n${resumeText}`
        : `Please review my resume and provide general feedback on how to improve it:\n\n${resumeText}`,
    },
  ]

  return callCareerCoach({ messages })
}

export async function generateInterviewPrep(jobDescription: string, userBackground?: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are an interview preparation expert. Help candidates prepare for job interviews by providing likely questions, suggested answers, and interview strategies.",
    },
    {
      role: "user",
      content: userBackground
        ? `Help me prepare for an interview for this position. Here's the job description and my background:\n\nJob Description:\n${jobDescription}\n\nMy Background:\n${userBackground}\n\nPlease provide likely interview questions and guidance on how to answer them.`
        : `Help me prepare for an interview for this position:\n\n${jobDescription}\n\nPlease provide likely interview questions and general interview advice.`,
    },
  ]

  return callCareerCoach({ messages })
}

export async function generateCoverLetter(
  jobDescription: string,
  userBackground: string,
  companyName: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a professional cover letter writer. Create compelling, personalized cover letters that highlight relevant experience and demonstrate genuine interest in the role and company.",
    },
    {
      role: "user",
      content: `Please write a cover letter for me for this position at ${companyName}:\n\nJob Description:\n${jobDescription}\n\nMy Background:\n${userBackground}\n\nPlease make it professional, engaging, and tailored to this specific role.`,
    },
  ]

  return callCareerCoach({ messages })
}

export async function analyzeJobDescription(jobDescription: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a job market analyst. Analyze job descriptions to extract key requirements, skills, and provide insights about the role and company expectations.",
    },
    {
      role: "user",
      content: `Please analyze this job description and provide insights about:\n1. Key requirements and qualifications\n2. Important skills to highlight\n3. Company culture indicators\n4. Salary expectations if possible\n5. Tips for standing out as a candidate\n\nJob Description:\n${jobDescription}`,
    },
  ]

  return callCareerCoach({ messages })
}

export async function generateCareerAdvice(userQuery: string, userContext?: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a senior career advisor with expertise in career development, job searching, networking, and professional growth. Provide thoughtful, actionable career advice.",
    },
  ]

  if (userContext) {
    messages.push({
      role: "user",
      content: `Here's some context about my situation: ${userContext}\n\nMy question: ${userQuery}`,
    })
  } else {
    messages.push({
      role: "user",
      content: userQuery,
    })
  }

  return callCareerCoach({ messages })
}
