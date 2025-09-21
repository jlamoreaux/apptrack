import type { OnboardingFlow } from "./types";

export const NEW_USER_FLOW: OnboardingFlow = {
  id: "new-user-onboarding",
  name: "Welcome to AppTrack",
  description: "Initial onboarding for new users",
  version: 1,
  triggers: ["first_login"],
  dismissible: true,
  steps: [
    {
      id: "welcome",
      type: "modal",
      title: "Welcome to AppTrack!",
      content:
        "Your job search just got a whole lot easier. Let's take a quick tour to help you get started.",
      position: "center",
      actions: [
        { label: "Skip Tour", action: "skip" },
        { label: "Show Me Around", action: "next" },
      ],
      skippable: true,
    },
    {
      id: "add-application",
      type: "spotlight",
      target: '[data-onboarding="add-application-button"]',
      title: "Track Your First Application",
      content:
        "Click here to add your first job application. You can track company, role, status, and more!",
      position: "bottom",
      actions: [{ label: "Got it", action: "next" }],
      skippable: false,
    },
    {
      id: "view-pipeline",
      type: "spotlight",
      target: '[data-onboarding="pipeline-chart"]',
      title: "Visualize Your Progress",
      content:
        "See your entire job search journey with our interactive Sankey chart. Watch your applications flow through different stages.",
      position: "top",
      actions: [{ label: "Next", action: "next" }],
    },
    {
      id: "ai-coach-intro",
      type: "tooltip",
      target: '[data-onboarding="ai-coach-nav"]',
      title: "Meet Your AI Coach",
      content:
        "Get help with resumes, cover letters, and interview prep. Your personal career assistant is always here!",
      position: "right",
      actions: [{ label: "Cool!", action: "next" }],
    },
    {
      id: "complete",
      type: "modal",
      title: "You're All Set! 🚀",
      content:
        "Start tracking your applications and let us help you land your dream job. Remember, we're here to support you every step of the way.",
      position: "center",
      actions: [{ label: "Start Tracking", action: "complete" }],
    },
  ],
};

export const AI_COACH_INTRO_FLOW: OnboardingFlow = {
  id: "ai-coach-feature",
  name: "AI Coach Introduction",
  description: "Introduce AI coaching features to users",
  version: 1,
  triggers: ["manual"],
  dismissible: true,
  conditions: [
    {
      type: "user_property",
      property: "subscription_plan",
      value: "ai_coach",
    },
  ],
  steps: [
    {
      id: "ai-features",
      type: "modal",
      title: "Your AI Coach is Ready! 🤖",
      content:
        "You now have access to powerful AI tools to supercharge your job search.",
      position: "center",
      actions: [{ label: "Show Me", action: "next" }],
    },
    {
      id: "resume-analyzer",
      type: "spotlight",
      target: '[data-onboarding="resume-analyzer"]',
      title: "Resume Analysis",
      content:
        "Upload your resume and get instant feedback on how to improve it for specific roles.",
      position: "bottom",
      actions: [{ label: "Next", action: "next" }],
    },
    {
      id: "cover-letter",
      type: "spotlight",
      target: '[data-onboarding="cover-letter-generator"]',
      title: "Cover Letter Generator",
      content:
        "Generate tailored cover letters in seconds. Just provide the job description!",
      position: "bottom",
      actions: [{ label: "Next", action: "next" }],
    },
    {
      id: "interview-prep",
      type: "spotlight",
      target: '[data-onboarding="interview-prep"]',
      title: "Interview Preparation",
      content:
        "Get personalized interview questions and talking points based on the job description.",
      position: "bottom",
      actions: [{ label: "Finish", action: "complete" }],
    },
  ],
};

export const FEATURE_ANNOUNCEMENT_FLOW: OnboardingFlow = {
  id: "sankey-chart-announcement",
  name: "New Feature: Enhanced Pipeline View",
  description: "Announcement for new Sankey chart features",
  version: 1,
  triggers: ["feature_launch"],
  priority: 10,
  dismissible: true,
  resetOnUpdate: false,
  steps: [
    {
      id: "announcement",
      type: "banner",
      title: "🎉 New Feature: Enhanced Pipeline Visualization",
      content:
        "Your application pipeline now shows more detailed insights with our improved Sankey charts!",
      position: "top",
      persistent: true,
      actions: [
        { label: "Dismiss", action: "skip" },
        { label: "Show Me", action: "next" },
      ],
    },
    {
      id: "show-feature",
      type: "spotlight",
      target: '[data-onboarding="pipeline-chart"]',
      title: "See Your Progress in Detail",
      content:
        "Hover over connections to see application counts. Click nodes to filter your view.",
      position: "top",
      actions: [{ label: "Got it!", action: "complete" }],
    },
  ],
};

// Registry of all flows
export const ONBOARDING_FLOWS: OnboardingFlow[] = [
  NEW_USER_FLOW,
  AI_COACH_INTRO_FLOW,
  FEATURE_ANNOUNCEMENT_FLOW,
];

// Helper to get flow by ID
export function getOnboardingFlow(flowId: string): OnboardingFlow | undefined {
  return ONBOARDING_FLOWS.find((flow) => flow.id === flowId);
}

// Helper to get flows by trigger
export function getFlowsByTrigger(trigger: string): OnboardingFlow[] {
  return ONBOARDING_FLOWS.filter((flow) =>
    flow.triggers.some(t => t === trigger)
  );
}
