import { callCareerCoach } from "../replicate/client";
import { PROMPT_BUILDERS } from "@/lib/constants/ai-prompts";
import { ChatMessage, ModelType } from "../replicate/types";
import { getModelConfig } from "./model-selector";

export async function generateResumeAdvice(
  resumeText: string,
  jobDescription?: string
): Promise<string> {
  const { systemPrompt, userPrompt } = PROMPT_BUILDERS.resumeReview(resumeText, jobDescription);
  const config = getModelConfig('resume_analysis');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  return callCareerCoach({ 
    messages, 
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}

export async function generateInterviewPrep(
  jobDescription: string,
  interviewContext?: string,
  resumeText?: string
): Promise<string> {
  const { systemPrompt, userPrompt } = PROMPT_BUILDERS.interviewPrep(jobDescription, resumeText, interviewContext);
  const config = getModelConfig('interview_prep');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  return callCareerCoach({ 
    messages, 
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}

export async function generateCoverLetter(
  jobDescription: string,
  userBackground: string,
  companyName: string,
  resumeText?: string
): Promise<string> {
  const { systemPrompt, userPrompt } = PROMPT_BUILDERS.coverLetter(jobDescription, companyName, userBackground, resumeText);
  const config = getModelConfig('cover_letter');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  return callCareerCoach({ 
    messages, 
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}

export async function analyzeJobDescription(
  jobDescription: string,
  resumeText?: string
): Promise<string> {
  const { systemPrompt, userPrompt } = PROMPT_BUILDERS.jobAnalysis(jobDescription, resumeText);
  const config = getModelConfig('job_fit_analysis');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  return callCareerCoach({ 
    messages, 
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}

export async function generateCareerAdvice(
  userQuery: string,
  userContext?: string,
  resumeText?: string
): Promise<string> {
  const { systemPrompt, userPrompt } = PROMPT_BUILDERS.careerAdvice(userQuery, userContext, resumeText);
  const config = getModelConfig('career_advice');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  return callCareerCoach({ 
    messages, 
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}

export async function generateJobFitAnalysis(
  jobDescription: string,
  resumeText: string,
  companyName: string,
  roleName: string
): Promise<string> {
  const { systemPrompt, userPrompt } = PROMPT_BUILDERS.jobFitAnalysis(jobDescription, resumeText, companyName, roleName);
  const config = getModelConfig('job_fit_analysis');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  // Use higher max tokens for detailed job fit analysis
  return callCareerCoach({ 
    messages, 
    model: config.model,
    maxTokens: 1500, // Premium model gets more tokens for complex analysis
    temperature: config.temperature,
  });
}

