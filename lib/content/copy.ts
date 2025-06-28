import copyData from "@/content/copy.json";
import { PLAN_LIMITS } from "@/lib/constants/plans";
import { Brain, FileText, MessageSquare, Target } from "lucide-react";

// Type-safe access to copy with validation
export const COPY = {
  ...copyData,
  // Dynamic content that uses constants
  pricing: {
    ...copyData.pricing,
    plans: {
      ...copyData.pricing.plans,
      free: {
        ...copyData.pricing.plans.free,
        features: [
          `Up to ${PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications`,
          ...copyData.pricing.plans.free.features.slice(1),
        ],
      },
    },
  },
  aiCoach: {
    dashboard: {
      title: "AI Coach Dashboard",
      features: [
        {
          id: "resume",
          title: "Resume Analysis",
          description:
            "Get AI-powered feedback on your resume with specific improvement suggestions",
          icon: Brain,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-200",
        },
        {
          id: "interview",
          title: "Interview Preparation",
          description:
            "Practice with AI-generated questions tailored to your target role",
          icon: MessageSquare,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        },
        {
          id: "cover-letter",
          title: "Cover Letter Generator",
          description:
            "Create compelling cover letters customized for each application",
          icon: FileText,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        },
        {
          id: "advice",
          title: "Career Advice",
          description:
            "Ask questions and get personalized career guidance from our AI coach",
          icon: Target,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
        },
      ],
      tabs: {
        resume: "Resume",
        interview: "Interview",
        coverLetter: "Cover Letter",
        advice: "Advice",
      },
    },
    resumeAnalyzer: {
      title: "Resume Analysis",
      description:
        "We'll use the resume you've already uploaded for analysis. If you'd like to analyze a different resume, you can upload a new one below. Uploading a new resume is optional. Optionally, you can also include a job description for targeted feedback.",
      resumeLabel: "Resume *",
      uploadButton: {
        default: "Upload Resume",
        processing: "Processing...",
      },
      uploadHint: "PDF, Word, or text files up to 5MB",
      pasteLabel: "Or paste your resume text",
      pastePlaceholder: "Paste your resume text here...",
      jobDescriptionLabel: "Job Description (Optional)",
      jobDescriptionPlaceholder:
        "Paste the job description for targeted analysis...",
      jdUrlPlaceholder: "https://company.com/jobs/position",
      fetchButton: "Fetch",
      analyzeButton: "Analyze",
      analysisTitle: "Your Analysis",
      tabs: {
        paste: "Paste Text",
        url: "From URL",
      },
    },
    careerAdvice: {
      title: "Career Advice",
      description:
        "Ask any career-related question and get personalized advice from our AI coach",
      questionLabel: "Your Question *",
      questionPlaceholder: "What would you like career advice about?",
      contextLabel: "Additional Context (Optional)",
      contextPlaceholder: "Provide any relevant background information...",
      sampleQuestionsLabel: "Sample Questions",
      getAdviceButton: {
        default: "Get Career Advice",
        loading: "Getting Advice...",
      },
      adviceTitle: "Your Advice",
      sampleQuestions: [
        "How do I negotiate salary for a new position?",
        "What skills should I focus on for career advancement?",
        "How do I transition to a different industry?",
        "What's the best way to network in my field?",
        "How do I handle a career gap in my resume?",
      ],
    },
    coverLetterGenerator: {
      title: "AI Cover Letter Generator",
      description:
        "Create a professional cover letter tailored to any job in seconds.",
      companyNameLabel: "Company Name",
      companyNamePlaceholder: "e.g. Google",
      backgroundLabel: "Your Background / Resume",
      backgroundPlaceholder:
        "Briefly describe your experience and skills, or paste your resume here.",
      jobDescriptionLabel: "Job Description",
      jobDescriptionPlaceholder: "Paste the job description here.",
      generateButton: "Generate Cover Letter",
      generatedTitle: "Generated Cover Letter:",
      successToast: {
        title: "Cover Letter Generated!",
        description: "Your new cover letter has been created successfully.",
      },
    },
    interviewPrep: {
      title: "AI Interview Prep",
      description:
        "Get tailored interview questions and talking points based on the job description.",
      jobDescriptionLabel: "Job Description",
      jobDescriptionPlaceholder: "Paste the job description here.",
      interviewContextLabel: "Interview Context (Optional)",
      interviewContextPlaceholder:
        "Share any information about the interview type, format, or specific concerns you have (e.g., 'This is a technical interview', 'I'm nervous about behavioral questions', 'It's a panel interview with 3 people').",
      generateButton: "Generate Interview Prep",
      generatedTitle: "Your Interview Prep",
      successToast: {
        title: "Interview Prep Generated!",
        description: "Your personalized interview prep is ready.",
      },
    },
  },
} as const;

// Get plan copy by plan name
export const getPlanCopy = (planName: string) => {
  const planKey = planName
    .toLowerCase()
    .replace(" ", "_") as keyof typeof COPY.pricing.plans;
  return COPY.pricing.plans[planKey];
};
