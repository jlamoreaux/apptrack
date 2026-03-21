"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3,
  Sparkles,
  Layers,
  TrendingUp,
  Filter,
  Clock,
  FileSearch,
  FileText,
  MessageSquare,
  Chrome,
  Users2,
  Bell,
  ArrowRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  screenshot: string
  alt: string
  features: Feature[]
  ctaHref: string
  ctaLabel: string
}

const TABS: Tab[] = [
  {
    id: "pipeline",
    label: "Pipeline View",
    icon: BarChart3,
    screenshot: "/screenshots/features/sankey-chart.png",
    alt: "Application pipeline Sankey chart",
    ctaHref: "/signup",
    ctaLabel: "Get Started Free",
    features: [
      {
        icon: TrendingUp,
        title: "Visualize your funnel",
        description: "See where applications drop off",
      },
      {
        icon: Filter,
        title: "Filter by status",
        description: "Focus on what needs attention",
      },
      {
        icon: Clock,
        title: "Track over time",
        description: "Monitor application velocity",
      },
    ],
  },
  {
    id: "ai-tools",
    label: "AI Career Tools",
    icon: Sparkles,
    screenshot: "/screenshots/features/interview-prep.png",
    alt: "AI interview preparation tool",
    ctaHref: "/try/interview-prep",
    ctaLabel: "Try Free",
    features: [
      {
        icon: FileSearch,
        title: "Resume analysis",
        description: "Get AI feedback on match strength",
      },
      {
        icon: FileText,
        title: "Cover letters",
        description: "Generate tailored letters in seconds",
      },
      {
        icon: MessageSquare,
        title: "Interview prep",
        description: "Practice with role-specific questions",
      },
    ],
  },
  {
    id: "track-organize",
    label: "Track & Organize",
    icon: Layers,
    screenshot: "/screenshots/hero/dashboard-desktop.png",
    alt: "Application tracking dashboard",
    ctaHref: "/signup",
    ctaLabel: "Get Started Free",
    features: [
      {
        icon: Chrome,
        title: "Browser extension",
        description: "Save jobs with one click",
      },
      {
        icon: Users2,
        title: "Contact tracking",
        description: "Track recruiters and managers",
      },
      {
        icon: Bell,
        title: "Smart reminders",
        description: "Never miss a follow-up",
      },
    ],
  },
]

const tabContentVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 10,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -10,
  }),
}

const featureVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
}

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState(0)
  const [direction, setDirection] = useState(0)

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const handleTabChange = (index: number) => {
    setDirection(index > activeTab ? 1 : -1)
    setActiveTab(index)
  }

  const currentTab = TABS[activeTab]

  return (
    <div>
      {/* Tab buttons */}
      <div role="tablist" className="inline-flex overflow-x-auto gap-1 mb-8 p-1 rounded-xl bg-muted border border-border scrollbar-hide">
        {TABS.map((tab, index) => {
          const Icon = tab.icon
          const isActive = index === activeTab
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => handleTabChange(index)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 min-h-[44px] ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentTab.id}
          role="tabpanel"
          id={`panel-${currentTab.id}`}
          aria-labelledby={`tab-${currentTab.id}`}
          custom={direction}
          variants={prefersReducedMotion ? undefined : tabContentVariants}
          initial={prefersReducedMotion ? false : "enter"}
          animate="center"
          exit={prefersReducedMotion ? undefined : "exit"}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeInOut" }}
          className="grid lg:grid-cols-5 gap-8 items-center"
        >
          {/* Screenshot — 60% */}
          <div className="lg:col-span-3">
            <div className="rounded-xl shadow-2xl border border-border overflow-hidden">
              <Image
                src={currentTab.screenshot}
                alt={currentTab.alt}
                width={800}
                height={500}
                className="w-full h-auto"
                sizes="(max-width: 768px) 100vw, 60vw"
                quality={85}
              />
            </div>
          </div>

          {/* Features — 40% */}
          <div className="lg:col-span-2 space-y-5">
            {currentTab.features.map((feature, i) => {
              const FeatureIcon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  custom={i}
                  variants={prefersReducedMotion ? undefined : featureVariants}
                  initial={prefersReducedMotion ? false : "hidden"}
                  animate="visible"
                  className="flex gap-3"
                >
                  <div className="mt-0.5 rounded-lg bg-surface-1 border border-border p-2 h-fit">
                    <FeatureIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{feature.title}</p>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              )
            })}

            <Link
              href={currentTab.ctaHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-2 min-h-[44px] py-2"
            >
              {currentTab.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
