import { callCareerCoach } from "../replicate/client";
import { SYSTEM_PROMPTS } from "../replicate/config";
import { ChatMessage, ModelType } from "../replicate/types";

export async function generateResumeAdvice(
  resumeText: string,
  jobDescription?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.RESUME_REVIEWER,
    },
    {
      role: "user",
      content: jobDescription
        ? `Please review my resume and provide feedback on how to better align it with this job description:\n\nJob Description:\n${jobDescription}\n\nMy Resume:\n${resumeText}`
        : `Please review my resume and provide general feedback on how to improve it:\n\n${resumeText}`,
    },
  ];

  return callCareerCoach({ messages });
}

export async function generateInterviewPrep(
  jobDescription: string,
  userBackground?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.INTERVIEW_PREP,
    },
    {
      role: "user",
      content: userBackground
        ? `Help me prepare for an interview for this position. Here's the job description and my background:\n\nJob Description:\n${jobDescription}\n\nMy Background:\n${userBackground}\n\nPlease provide likely interview questions and guidance on how to answer them.`
        : `Help me prepare for an interview for this position:\n\n${jobDescription}\n\nPlease provide likely interview questions and general interview advice.`,
    },
  ];

  return callCareerCoach({ messages });
}

export async function generateCoverLetter(
  jobDescription: string,
  userBackground: string,
  companyName: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.COVER_LETTER_WRITER,
    },
    {
      role: "user",
      content: `Please write a cover letter for me for this position at ${companyName}:\n\nJob Description:\n${jobDescription}\n\nMy Background:\n${userBackground}\n\nPlease make it professional, engaging, and tailored to this specific role.`,
    },
  ];

  return callCareerCoach({ messages });
}

export async function analyzeJobDescription(
  jobDescription: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.JOB_ANALYST,
    },
    {
      role: "user",
      content: `Please analyze this job description and provide insights about:\n1. Key requirements and qualifications\n2. Important skills to highlight\n3. Company culture indicators\n4. Salary expectations if possible\n5. Tips for standing out as a candidate\n\nJob Description:\n${jobDescription}`,
    },
  ];

  return callCareerCoach({ messages });
}

export async function generateCareerAdvice(
  userQuery: string,
  userContext?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.CAREER_ADVISOR,
    },
  ];

  if (userContext) {
    messages.push({
      role: "user",
      content: `Here's some context about my situation: ${userContext}\n\nMy question: ${userQuery}`,
    });
  } else {
    messages.push({
      role: "user",
      content: userQuery,
    });
  }

  return callCareerCoach({ messages });
}

// Helper functions for easy model swapping
export async function generateResumeAdviceWithModel(
  resumeText: string,
  model: ModelType,
  jobDescription?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.RESUME_REVIEWER,
    },
    {
      role: "user",
      content: jobDescription
        ? `Please review my resume and provide feedback on how to better align it with this job description:\n\nJob Description:\n${jobDescription}\n\nMy Resume:\n${resumeText}`
        : `Please review my resume and provide general feedback on how to improve it:\n\n${resumeText}`,
    },
  ];

  return callCareerCoach({ messages, model });
}

export async function generateInterviewPrepWithModel(
  jobDescription: string,
  model: ModelType,
  userBackground?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.INTERVIEW_PREP,
    },
    {
      role: "user",
      content: userBackground
        ? `Help me prepare for an interview for this position. Here's the job description and my background:\n\nJob Description:\n${jobDescription}\n\nMy Background:\n${userBackground}\n\nPlease provide likely interview questions and guidance on how to answer them.`
        : `Help me prepare for an interview for this position:\n\n${jobDescription}\n\nPlease provide likely interview questions and general interview advice.`,
    },
  ];

  return callCareerCoach({ messages, model });
}

export async function generateCoverLetterWithModel(
  jobDescription: string,
  userBackground: string,
  companyName: string,
  model: ModelType
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.COVER_LETTER_WRITER,
    },
    {
      role: "user",
      content: `Please write a cover letter for me for this position at ${companyName}:\n\nJob Description:\n${jobDescription}\n\nMy Background:\n${userBackground}\n\nPlease make it professional, engaging, and tailored to this specific role.`,
    },
  ];

  return callCareerCoach({ messages, model });
}

export async function analyzeJobDescriptionWithModel(
  jobDescription: string,
  model: ModelType
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.JOB_ANALYST,
    },
    {
      role: "user",
      content: `Please analyze this job description and provide insights about:\n1. Key requirements and qualifications\n2. Important skills to highlight\n3. Company culture indicators\n4. Salary expectations if possible\n5. Tips for standing out as a candidate\n\nJob Description:\n${jobDescription}`,
    },
  ];

  return callCareerCoach({ messages, model });
}

export async function generateCareerAdviceWithModel(
  userQuery: string,
  model: ModelType,
  userContext?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.CAREER_ADVISOR,
    },
  ];

  if (userContext) {
    messages.push({
      role: "user",
      content: `Here's some context about my situation: ${userContext}\n\nMy question: ${userQuery}`,
    });
  } else {
    messages.push({
      role: "user",
      content: userQuery,
    });
  }

  return callCareerCoach({ messages, model });
}
