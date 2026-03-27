// Central AI feature color theming
export const AI_THEME = {
  // Primary AI brand colors
  brand: {
    primary: "amber-600",
    secondary: "orange-600",
    light: "amber-50",
    dark: "amber-700",
  },
  
  // Color classes for different contexts
  classes: {
    // Text colors
    text: {
      primary: "text-amber-600 dark:text-amber-400",
      secondary: "text-orange-600 dark:text-orange-400",
      muted: "text-amber-600/70 dark:text-amber-400/70",
    },
    
    // Background colors
    background: {
      solid: "bg-amber-600",
      light: "bg-amber-50 dark:bg-amber-950/20",
      gradient: "bg-gradient-to-r from-amber-600 to-orange-600",
      gradientLight: "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
      gradientSubtle: "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10",
    },
    
    // Border colors
    border: {
      default: "border-amber-200 dark:border-amber-800",
      strong: "border-amber-500 dark:border-amber-600",
      subtle: "border-amber-500/20 dark:border-amber-400/30",
    },
    
    // Interactive states
    hover: {
      background: "hover:bg-amber-700 hover:to-orange-700",
      text: "hover:text-amber-700 dark:hover:text-amber-300",
      subtle: "hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/20 dark:hover:text-amber-300",
    },
    
    // Focus states
    focus: {
      ring: "focus:ring-amber-500 focus:ring-offset-2",
      border: "focus:border-amber-500",
    },
    
    // Complete button classes
    button: {
      primary: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white",
      secondary: "bg-white text-amber-600 hover:bg-amber-50 dark:bg-gray-800 dark:text-amber-400 dark:hover:bg-gray-700",
      outline: "border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/20",
    },
    
    // Badge classes
    badge: {
      default: "bg-gradient-to-r from-amber-600 to-orange-600 text-white",
      subtle: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    
    // Card classes
    card: {
      border: "border-2 border-amber-500/20 dark:border-amber-400/30",
      background: "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-500/5 dark:via-orange-500/5 dark:to-amber-500/5",
      highlight: "ring-2 ring-amber-500 ring-opacity-50",
    },
    
    // Icon containers
    iconContainer: {
      default: "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400",
      gradient: "bg-gradient-to-br from-amber-600 to-orange-600 text-white",
      bordered: "border border-amber-200 dark:border-amber-800",
    },
  },
  
  // Helper functions for dynamic color generation
  withOpacity: (colorClass: string, opacity: number) => {
    return `${colorClass}/${opacity}`;
  },
  
  // Get complete class string for common patterns
  getButtonClasses: (variant: "primary" | "secondary" | "outline" = "primary") => {
    return AI_THEME.classes.button[variant];
  },
  
  getBadgeClasses: (variant: "default" | "subtle" = "default") => {
    return AI_THEME.classes.badge[variant];
  },
  
  getCardClasses: (includeHighlight = false) => {
    const base = `${AI_THEME.classes.card.border} ${AI_THEME.classes.card.background}`;
    return includeHighlight ? `${base} ${AI_THEME.classes.card.highlight}` : base;
  },
  
  getIconContainerClasses: (variant: "default" | "gradient" | "bordered" = "default") => {
    const base = AI_THEME.classes.iconContainer[variant];
    return variant === "bordered" 
      ? `${AI_THEME.classes.iconContainer.default} ${base}`
      : base;
  },
} as const;

// Semantic token version — uses CSS variables that adapt to dark mode automatically
const AI_THEME_SEMANTIC = {
  classes: {
    text: {
      primary: "text-ai-brand",
      secondary: "text-accent",
      muted: "text-ai-brand/70",
    },
    background: {
      solid: "bg-ai-brand",
      light: "bg-ai-brand-light",
      gradient: "bg-gradient-to-r from-amber-600 to-orange-600", // gradients can't use CSS vars
      gradientLight: "bg-ai-brand-light",
      gradientSubtle: "bg-ai-brand/10",
    },
    border: {
      default: "border-ai-brand/20",
      strong: "border-ai-brand",
      subtle: "border-ai-brand/10",
    },
    hover: {
      background: "hover:bg-ai-brand/90",
      text: "hover:text-ai-brand/80",
      subtle: "hover:bg-ai-brand-light hover:text-ai-brand",
    },
    focus: {
      ring: "focus:ring-ai-brand focus:ring-offset-2",
      border: "focus:border-ai-brand",
    },
    button: {
      primary: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white",
      secondary: "bg-card text-ai-brand hover:bg-ai-brand-light",
      outline: "border-ai-brand/20 text-ai-brand hover:bg-ai-brand-light",
    },
    badge: {
      default: "bg-gradient-to-r from-amber-600 to-orange-600 text-white",
      subtle: "bg-ai-brand-light text-ai-brand",
    },
    card: {
      border: "border-2 border-ai-brand/20",
      background: "bg-ai-brand/5",
      highlight: "ring-2 ring-ai-brand ring-opacity-50",
    },
    iconContainer: {
      default: "bg-ai-brand-light text-ai-brand",
      gradient: "bg-gradient-to-br from-amber-600 to-orange-600 text-white",
      bordered: "border border-ai-brand/20",
    },
  },
} as const;

/**
 * Returns AI theme classes based on whether semantic tokens should be used.
 * When useSemanticTokens is true, returns CSS variable-based classes that
 * automatically adapt to dark mode without manual dark: prefixes.
 */
export function getAIThemeClasses(useSemanticTokens: boolean) {
  if (useSemanticTokens) {
    return {
      ...AI_THEME_SEMANTIC.classes,
      getButtonClasses: (variant: "primary" | "secondary" | "outline" = "primary") =>
        AI_THEME_SEMANTIC.classes.button[variant],
      getBadgeClasses: (variant: "default" | "subtle" = "default") =>
        AI_THEME_SEMANTIC.classes.badge[variant],
      getCardClasses: (includeHighlight = false) => {
        const base = `${AI_THEME_SEMANTIC.classes.card.border} ${AI_THEME_SEMANTIC.classes.card.background}`;
        return includeHighlight ? `${base} ${AI_THEME_SEMANTIC.classes.card.highlight}` : base;
      },
      getIconContainerClasses: (variant: "default" | "gradient" | "bordered" = "default") => {
        const base = AI_THEME_SEMANTIC.classes.iconContainer[variant];
        return variant === "bordered"
          ? `${AI_THEME_SEMANTIC.classes.iconContainer.default} ${base}`
          : base;
      },
    };
  }

  return {
    ...AI_THEME.classes,
    getButtonClasses: AI_THEME.getButtonClasses,
    getBadgeClasses: AI_THEME.getBadgeClasses,
    getCardClasses: AI_THEME.getCardClasses,
    getIconContainerClasses: AI_THEME.getIconContainerClasses,
  };
}

// Feature-specific color mappings (for backward compatibility)
export const AI_FEATURE_COLORS = {
  resume: "amber",
  interview: "blue",
  advice: "green",
  "cover-letter": "orange",
} as const;

// Export type for AI theme
export type AITheme = typeof AI_THEME;