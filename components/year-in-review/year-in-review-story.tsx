"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import type { YearInReviewStats } from "@/lib/year-in-review/types";
import { buildSlides, type Slide } from "./slides";
import { SharePanel } from "./share-panel";

interface YearInReviewStoryProps {
  stats: YearInReviewStats;
}

const NEUTRAL_TINT = "hsl(var(--card))";
const NEUTRAL_INK = "hsl(var(--card-foreground))";

export function YearInReviewStory({ stats }: YearInReviewStoryProps) {
  const slides = useMemo<Slide[]>(
    () => [
      ...buildSlides(stats),
      {
        id: "share",
        content: <SharePanel year={stats.year} outcomeCompany={stats.outcome?.company ?? null} />,
      },
    ],
    [stats]
  );
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
  const completed = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const hasNavigated = useRef(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    capturePostHogEvent("year_in_review_viewed", { year: stats.year, label: stats.label });
  }, [stats.year, stats.label]);

  useEffect(() => {
    if (index === slides.length - 1 && !completed.current) {
      completed.current = true;
      capturePostHogEvent("year_in_review_completed", { year: stats.year, label: stats.label });
    }
  }, [index, slides.length, stats.year, stats.label]);

  const go = useCallback(
    (delta: number) => {
      hasNavigated.current = true;
      setDirection(delta);
      setIndex((current) => Math.min(slides.length - 1, Math.max(0, current + delta)));
    },
    [slides.length]
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Leave browser shortcuts (Alt+Left is Back) and focused controls alone.
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, [contenteditable], [role='switch'], [role='menuitem']")) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const offset = reduceMotion ? 0 : 40 * direction;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`Your ${stats.year} in review`}
      className="relative flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden"
      style={{ backgroundColor: slide.tint ?? NEUTRAL_TINT, color: slide.ink ?? NEUTRAL_INK }}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <ol className="flex flex-1 gap-1" aria-label="Progress">
          {slides.map((s, i) => (
            <li key={s.id} className="relative h-1 flex-1 overflow-hidden rounded-full">
              <span className="absolute inset-0 bg-current opacity-20" />
              <span
                className="absolute inset-0 origin-left bg-current transition-transform duration-300"
                style={{ transform: `scaleX(${i <= index ? 1 : 0})` }}
              />
              <span className="sr-only">{i < index ? "Seen" : i === index ? "Current" : "Not seen"}</span>
            </li>
          ))}
        </ol>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard" aria-label="Close year in review">
            <X className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      <div
        className="relative flex flex-1 items-center"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined) return;
          if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
        }}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -offset }}
            transition={{ duration: reduceMotion ? 0.01 : 0.35, ease: "easeOut" }}
            onAnimationComplete={(definition) => {
              // Focus once the entering card has finished animating in: with
              // mode="wait" the new card mounts only after the old one exits.
              // Skipped on first render, where it would steal focus from the page.
              const entered = typeof definition === "object" && definition !== null && "opacity" in definition && definition.opacity === 1;
              if (entered && hasNavigated.current) headingRef.current?.focus();
            }}
            className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10"
          >
            <div
              ref={headingRef}
              tabIndex={-1}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
              className="outline-none"
            >
              {slide.content}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-4 pb-6">
        <Button variant="ghost" size="lg" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous card">
          <ChevronLeft className="mr-1 h-5 w-5" />
          Back
        </Button>
        <span className="text-sm opacity-80" aria-hidden="true">{`${index + 1} / ${slides.length}`}</span>
        {isLast ? (
          <Button variant="ghost" size="lg" asChild>
            <Link href="/dashboard">Done</Link>
          </Button>
        ) : (
          <Button variant="ghost" size="lg" onClick={() => go(1)} aria-label="Next card">
            Next
            <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        )}
      </div>
    </section>
  );
}
