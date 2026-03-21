import type { Config } from "tailwindcss";
import { generateTailwindColors } from "./lib/constants/accessible-colors";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        // Generate status/form colors from accessible-colors.ts
        ...generateTailwindColors(),

        // ─── Semantic surface tokens ───
        border: "hsl(var(--border))",
        "border-subtle": "hsl(var(--border-subtle))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "surface-1": "hsl(var(--card))",
        "surface-2": "hsl(var(--popover))",
        "surface-raised": "hsl(var(--surface-raised))",
        tertiary: "hsl(var(--tertiary-foreground))",

        // ─── Brand colors ───
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ─── Icon badge tokens ───
        "badge-indigo": { DEFAULT: "hsl(var(--badge-indigo))", fg: "hsl(var(--badge-indigo-fg))" },
        "badge-emerald": { DEFAULT: "hsl(var(--badge-emerald))", fg: "hsl(var(--badge-emerald-fg))" },
        "badge-violet": { DEFAULT: "hsl(var(--badge-violet))", fg: "hsl(var(--badge-violet-fg))" },
        "badge-orange": { DEFAULT: "hsl(var(--badge-orange))", fg: "hsl(var(--badge-orange-fg))" },
        "badge-neutral": { DEFAULT: "hsl(var(--badge-neutral))", fg: "hsl(var(--badge-neutral-fg))" },

        // ─── Section backgrounds ───
        "section-hero": "hsl(var(--section-hero))",
        "section-ai-tools": "hsl(var(--section-ai-tools))",
        "section-pricing": "hsl(var(--section-pricing))",
        "section-cta": {
          DEFAULT: "hsl(var(--section-cta))",
          foreground: "hsl(var(--section-cta-foreground))",
          muted: "hsl(var(--section-cta-muted))",
        },

        // ─── Interactive ───
        "interactive-hover": "hsl(var(--interactive-hover))",
        // New brand colors
        coral: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },
        indigo: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar, var(--background)))",
          foreground: "hsl(var(--sidebar-foreground, var(--foreground)))",
          accent: "hsl(var(--sidebar-accent, var(--accent)))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground, var(--accent-foreground)))",
          border: "hsl(var(--sidebar-border, var(--border)))",
          ring: "hsl(var(--sidebar-ring, var(--ring)))",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        dropdown: "0 4px 16px 0 rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        modal: "0 20px 60px -12px rgb(0 0 0 / 0.15), 0 8px 20px -8px rgb(0 0 0 / 0.1)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "200ms",
        slow: "300ms",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
