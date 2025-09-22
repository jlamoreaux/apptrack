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
    FREE_USERS: 1,
    AUTHENTICATED_PER_DAY: 10,
    AUTHENTICATED_PER_HOUR: 3
  }
} as const;

export const ROAST_ERRORS = {
  FILE_TOO_LARGE: "File size must be less than 5MB",
  INVALID_FILE_TYPE: "Please upload a PDF, DOC, or DOCX file",
  ALREADY_USED: "You've already used your free roast! Sign up for unlimited roasts.",
  RATE_LIMITED: "You've reached your roast limit. Please try again later.",
  GENERIC: "Something went wrong. Please try again."
} as const;