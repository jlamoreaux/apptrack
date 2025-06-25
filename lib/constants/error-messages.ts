export const ERROR_MESSAGES = {
  // Generic errors
  UNEXPECTED: "An unexpected error occurred. Please try again.",

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
  },

  // Add other feature groups as needed
} as const;
