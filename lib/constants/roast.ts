// Roast feature constants
export const ROAST_CONSTANTS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_FILE_TYPES: [
    "application/pdf",
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ],
  SUPPORTED_EXTENSIONS: ["pdf", "doc", "docx"],
  EXPIRY_DAYS: 30,
  RATE_LIMIT: {
    GUEST_PER_DAY: 3,         // Per version (so 6 total if using both v1 and v2)
    FREE_USER_PER_DAY: 10,    // Per version
    PRO_USER_PER_DAY: 100,    // Per version
    PER_HOUR: 10              // Hourly limit for all users
  }
} as const;

export const ROAST_ERRORS = {
  FILE_TOO_LARGE: "File size must be less than 5MB",
  INVALID_FILE_TYPE: "Please upload a PDF, DOC, or DOCX file",
  ALREADY_USED: "You've already used your free roast! Sign up for unlimited roasts.",
  RATE_LIMITED: "Whoa there, roast enthusiast! Sign up for a free account to keep roasting.",
  GENERIC: "Something went wrong. Please try again."
} as const;