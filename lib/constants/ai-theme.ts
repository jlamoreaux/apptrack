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

// Feature-specific color mappings (for backward compatibility)
export const AI_FEATURE_COLORS = {
  resume: "amber",
  interview: "blue", 
  advice: "green",
  "cover-letter": "orange",
} as const;

// Export type for AI theme
export type AITheme = typeof AI_THEME;