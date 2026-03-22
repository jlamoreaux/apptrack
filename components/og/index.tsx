// OG Image Component Utilities for Edge Runtime
// Note: These return JSX elements directly, not React components
// This is required for Next.js ImageResponse in Edge runtime

export const OG_COLORS = {
  primary: "#4338CA",        // Indigo-700 — brand primary
  accent: "#F97316",         // Coral — CTAs
  secondary: "#059669",      // Emerald-600 — success
  background: "#F8F7F5",     // Warm off-white (hsl 40 6% 97%)
  foreground: "#1F1A14",     // Warm near-black (hsl 20 15% 12%)
  muted: "#6B6560",          // Secondary text (hsl 20 5% 42%)
  mutedLight: "#8A8580",     // Tertiary text (hsl 20 5% 55%)
  border: "#E5E0DA",         // Card borders (hsl 30 8% 88%)
  fire: {
    orange: "#f97316",
    red: "#ef4444",
    purple: "#9333ea",
    yellow: "#fbbf24",
  }
};

export const OG_SIZE = {
  width: 1200,
  height: 630,
};