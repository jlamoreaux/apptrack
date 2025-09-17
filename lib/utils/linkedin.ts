/**
 * LinkedIn URL parsing and profile utilities
 */

/**
 * Parse a LinkedIn URL and extract the username
 */
export function parseLinkedInUrl(url: string): string | null {
  try {
    // Handle various LinkedIn URL formats
    // https://www.linkedin.com/in/username
    // https://linkedin.com/in/username/
    // https://www.linkedin.com/in/username/details/experience/
    const match = url.match(/linkedin\.com\/in\/([^/?]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract profile information from LinkedIn URL
 */
export function extractProfileInfoFromUrl(url: string) {
  const username = parseLinkedInUrl(url);
  
  if (!username) {
    return { username: null, suggestedName: null };
  }

  // Convert username to suggested name
  // john-doe-phd -> John Doe Phd
  const suggestedName = username
    .split("-")
    .map(word => {
      // Handle common suffixes
      if (["phd", "mba", "md", "jd", "cpa"].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return { username, suggestedName };
}

/**
 * Validate if a URL is a valid LinkedIn profile URL
 */
export function isValidLinkedInUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("linkedin.com") &&
      urlObj.pathname.includes("/in/")
    );
  } catch {
    return false;
  }
}

/**
 * Format LinkedIn profile URL to standard format
 */
export function formatLinkedInUrl(url: string): string {
  const username = parseLinkedInUrl(url);
  if (!username) return url;
  
  // Return clean, standardized URL
  return `https://www.linkedin.com/in/${username}`;
}

/**
 * Get initials from name for avatar fallback
 */
export function getInitialsFromName(name?: string | null): string {
  if (!name) return "LP";
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "LP";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  
  // Get first letter of first name and last name
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}