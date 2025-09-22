import pdf from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromResume(
  file: File
): Promise<{ text: string; firstName: string | null }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  let text = "";
  
  if (file.type === "application/pdf") {
    const data = await pdf(buffer);
    text = data.text;
  } else if (
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    throw new Error("Unsupported file type");
  }
  
  // Extract first name before PII filtering
  const firstName = extractFirstName(text);
  
  // Clean and normalize text
  text = text.trim().replace(/\s+/g, " ");
  
  return { text, firstName };
}

function extractFirstName(text: string): string | null {
  // Common patterns for finding names at the beginning of resumes
  const lines = text.split("\n").slice(0, 10); // Check first 10 lines
  
  for (const line of lines) {
    const cleanLine = line.trim();
    
    // Skip empty lines and obvious non-name content
    if (!cleanLine || cleanLine.length > 50) continue;
    if (/^(curriculum|vitae|resume|cv|contact|email|phone|address)/i.test(cleanLine)) continue;
    
    // Look for typical name patterns (2-3 words starting with capitals)
    const namePattern = /^([A-Z][a-z]+)(?:\s+[A-Z][a-z]+){0,2}$/;
    const match = cleanLine.match(namePattern);
    
    if (match) {
      return match[1]; // Return just the first name
    }
  }
  
  // Fallback: try to find any capitalized word that looks like a first name
  const fallbackPattern = /\b([A-Z][a-z]{2,15})\b/;
  const fallbackMatch = text.match(fallbackPattern);
  
  return fallbackMatch ? fallbackMatch[1] : null;
}

export function filterPII(text: string, firstName: string | null): string {
  // Email addresses
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]"
  );
  
  // Phone numbers (various formats)
  text = text.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{0,4}/g,
    (match) => {
      // Only replace if it looks like a phone number (7+ digits)
      const digits = match.replace(/\D/g, "");
      return digits.length >= 7 ? "[PHONE]" : match;
    }
  );
  
  // Social Security Numbers
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
  
  // URLs (but keep domain names for context)
  text = text.replace(
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g,
    (match) => {
      const domain = match.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return domain ? `[LINK: ${domain[1].split(".")[0]}]` : "[LINK]";
    }
  );
  
  // LinkedIn profiles
  text = text.replace(
    /linkedin\.com\/in\/[\w-]+/gi,
    "linkedin.com/in/[PROFILE]"
  );
  
  // GitHub profiles
  text = text.replace(
    /github\.com\/[\w-]+/gi,
    "github.com/[PROFILE]"
  );
  
  // Street addresses (basic pattern)
  text = text.replace(
    /\d+\s+[\w\s]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl|Square|Sq|Way|Parkway|Pkwy)\.?\b/gi,
    "[ADDRESS]"
  );
  
  // ZIP codes
  text = text.replace(/\b\d{5}(-\d{4})?\b/g, "[ZIP]");
  
  // Replace full names (if we detected a first name, try to remove last names)
  if (firstName) {
    // Look for patterns like "FirstName LastName" and keep only FirstName
    const namePattern = new RegExp(
      `\\b${firstName}\\s+[A-Z][a-z]+\\b`,
      "g"
    );
    text = text.replace(namePattern, firstName);
  }
  
  return text;
}