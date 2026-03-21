/**
 * AppTrack Design Token Reference
 *
 * This file documents the semantic token system.
 * Actual values are defined as CSS variables in globals.css.
 * Tailwind config maps these to utility classes.
 *
 * USAGE RULE: Components should ONLY use these semantic tokens,
 * never raw color values like bg-indigo-100 or text-stone-700.
 *
 * Example:
 *   BAD:  className="bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700"
 *   GOOD: className="bg-surface-1 border-border"
 */

export const TOKENS = {
  // ─── SURFACES (elevation hierarchy) ───────────────────────
  // Each level is visibly lighter than the last in dark mode
  surfaces: {
    background: "bg-background",           // Page background (darkest in dark mode)
    "surface-1": "bg-surface-1",           // Cards, panels
    "surface-2": "bg-surface-2",           // Elevated cards, modals, popovers
    "surface-3": "bg-surface-3",           // Tooltips, dropdowns, chips
    "surface-raised": "bg-surface-raised", // Icon badge containers, subtle highlights
  },

  // ─── BORDERS ──────────────────────────────────────────────
  borders: {
    default: "border-border",              // Standard card/section borders
    subtle: "border-border-subtle",        // Very subtle dividers
    strong: "border-border-strong",        // Emphasized borders, focus rings
  },

  // ─── TEXT ─────────────────────────────────────────────────
  text: {
    primary: "text-foreground",            // Headings, primary body text
    secondary: "text-muted-foreground",    // Descriptions, subtitles
    tertiary: "text-tertiary",             // Captions, timestamps
    link: "text-primary",                  // Links
    inverse: "text-white",                 // Text on dark/accent backgrounds
  },

  // ─── ICON BADGES ──────────────────────────────────────────
  // Colored background containers for feature icons
  badges: {
    indigo: "bg-badge-indigo text-badge-indigo-fg",
    emerald: "bg-badge-emerald text-badge-emerald-fg",
    violet: "bg-badge-violet text-badge-violet-fg",
    orange: "bg-badge-orange text-badge-orange-fg",
    neutral: "bg-badge-neutral text-badge-neutral-fg",
  },

  // ─── SECTIONS ─────────────────────────────────────────────
  sections: {
    default: "",                            // Transparent (inherits background)
    muted: "bg-section-muted",             // Alternating sections (pricing, AI tools)
    dark: "bg-section-dark text-white",    // Dark sections (final CTA)
  },

  // ─── INTERACTIVE ──────────────────────────────────────────
  interactive: {
    hover: "hover:bg-interactive-hover",
    focusRing: "focus-visible:ring-ring",
  },
} as const;
