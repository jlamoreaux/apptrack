export const ERROR_MESSAGES = {
  // Generic errors
  UNEXPECTED: "An unexpected error occurred. Please try again.",
  UNAUTHORIZED: "Unauthorized",
  AI_COACH_REQUIRED: "AI Coach features require an AI Coach subscription",
  MISSING_REQUIRED_FIELDS: "Required fields are missing",
  FETCH_JOB_DESCRIPTION_FAILED: "Failed to fetch job description",
  JOB_FIT_ANALYSIS_FAILED: "Failed to analyze job fit",

  // AI Coach feature errors
  AI_COACH: {
    RESUME_ANALYZER: {
      FILE_TOO_LARGE: "File size must be less than 5MB.",
      INVALID_FILE_TYPE: "Please upload a PDF, Word document, or text file.",
      RESUME_PROCESSING_FAILED: "Failed to process resume.",
      URL_FETCH_FAILED: "Failed to fetch job description from the URL.",
      MISSING_URL: "Please enter a job posting URL.",
      MISSING_RESUME: "Please provide your resume text or upload a file.",
      ANALYSIS_FAILED: "Failed to analyze resume.",
    },
    INTERVIEW_PREP: {
      MISSING_JOB_DESCRIPTION: "Please provide a job description.",
      GENERATION_FAILED: "Failed to generate interview prep.",
    },
    COVER_LETTER: {
      MISSING_INFO:
        "Please provide the company name, your background, and the job description.",
      GENERATION_FAILED: "Failed to generate cover letter.",
    },
    CAREER_ADVICE: {
      MISSING_QUESTION: "Please enter your question.",
      GENERATION_FAILED: "Failed to get career advice.",
    },
    JOB_FIT_ANALYSIS: {
      MISSING_JOB_URL: "Job URL is required",
      MISSING_COMPANY_NAME: "Company name is required",
      MISSING_ROLE_NAME: "Role name is required",
      ANALYSIS_FAILED: "Failed to analyze job fit",
    },
  },

  // Add other feature groups as needed
} as const;
