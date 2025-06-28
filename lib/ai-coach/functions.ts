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
  interviewContext?: string,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.INTERVIEW_PREP,
    },
  ];

  let content = `Help me prepare for an interview for this position:\n\nJob Description:\n${jobDescription}`;

  if (resumeText) {
    content += `\n\nMy Resume:\n${resumeText}`;
  }

  if (interviewContext) {
    content += `\n\nInterview Context:\n${interviewContext}`;
  }

  content += `\n\nPlease provide likely interview questions and guidance on how to answer them based on my background and the job requirements.`;

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages });
}

export async function generateCoverLetter(
  jobDescription: string,
  userBackground: string,
  companyName: string,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.COVER_LETTER_WRITER,
    },
  ];

  let content = `Please write a cover letter for me for this position at ${companyName}:\n\nJob Description:\n${jobDescription}`;

  if (resumeText) {
    content += `\n\nMy Resume:\n${resumeText}`;
  }

  content += `\n\nMy Background:\n${userBackground}\n\nPlease make it professional, engaging, and tailored to this specific role.`;

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages });
}

export async function analyzeJobDescription(
  jobDescription: string,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.JOB_ANALYST,
    },
  ];

  let content = `Please analyze this job description and provide insights about:\n1. Key requirements and qualifications\n2. Important skills to highlight\n3. Company culture indicators\n4. Salary expectations if possible\n5. Tips for standing out as a candidate`;

  if (resumeText) {
    content += `\n6. How well my background matches this role`;
  }

  content += `\n\nJob Description:\n${jobDescription}`;

  if (resumeText) {
    content += `\n\nMy Resume:\n${resumeText}`;
  }

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages });
}

export async function generateCareerAdvice(
  userQuery: string,
  userContext?: string,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.CAREER_ADVISOR,
    },
  ];

  let content = "";

  if (resumeText) {
    content += `My Resume:\n${resumeText}\n\n`;
  }

  if (userContext) {
    content += `Here's some context about my situation: ${userContext}\n\n`;
  }

  content += `My question: ${userQuery}`;

  messages.push({
    role: "user",
    content,
  });

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
  interviewContext?: string,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.INTERVIEW_PREP,
    },
  ];

  let content = `Help me prepare for an interview for this position:\n\nJob Description:\n${jobDescription}`;

  if (resumeText) {
    content += `\n\nMy Resume:\n${resumeText}`;
  }

  if (interviewContext) {
    content += `\n\nInterview Context:\n${interviewContext}`;
  }

  content += `\n\nPlease provide likely interview questions and guidance on how to answer them based on my background and the job requirements.`;

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages, model });
}

export async function generateCoverLetterWithModel(
  jobDescription: string,
  userBackground: string,
  companyName: string,
  model: ModelType,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.COVER_LETTER_WRITER,
    },
  ];

  let content = `Please write a cover letter for me for this position at ${companyName}:\n\nJob Description:\n${jobDescription}`;

  if (resumeText) {
    content += `\n\nMy Resume:\n${resumeText}`;
  }

  content += `\n\nMy Background:\n${userBackground}\n\nPlease make it professional, engaging, and tailored to this specific role.`;

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages, model });
}

export async function analyzeJobDescriptionWithModel(
  jobDescription: string,
  model: ModelType,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.JOB_ANALYST,
    },
  ];

  let content = `Please analyze this job description and provide insights about:\n1. Key requirements and qualifications\n2. Important skills to highlight\n3. Company culture indicators\n4. Salary expectations if possible\n5. Tips for standing out as a candidate`;

  if (resumeText) {
    content += `\n6. How well my background matches this role`;
  }

  content += `\n\nJob Description:\n${jobDescription}`;

  if (resumeText) {
    content += `\n\nMy Resume:\n${resumeText}`;
  }

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages, model });
}

export async function generateCareerAdviceWithModel(
  userQuery: string,
  model: ModelType,
  userContext?: string,
  resumeText?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPTS.CAREER_ADVISOR,
    },
  ];

  let content = "";

  if (resumeText) {
    content += `My Resume:\n${resumeText}\n\n`;
  }

  if (userContext) {
    content += `Here's some context about my situation: ${userContext}\n\n`;
  }

  content += `My question: ${userQuery}`;

  messages.push({
    role: "user",
    content,
  });

  return callCareerCoach({ messages, model });
}
