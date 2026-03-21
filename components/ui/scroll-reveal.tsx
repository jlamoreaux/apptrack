"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  once?: boolean;
}

const directionMap = {
  up: { y: 1 },
  down: { y: -1 },
  left: { x: 1 },
  right: { x: -1 },
  none: {},
};

export function ScrollReveal({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 24,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-64px" });
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      // Only enable scroll animation for elements that start below the viewport.
      // Elements already visible skip animation to avoid a flash of invisible content.
      if (!inViewport) {
        setShouldAnimate(true);
      }
    }
  }, []);

  const dir = directionMap[direction];
  const hiddenState: Record<string, number> = { opacity: 0 };
  if ("y" in dir) hiddenState.y = dir.y! * distance;
  if ("x" in dir) hiddenState.x = dir.x! * distance;

  const visibleState = { opacity: 1, y: 0, x: 0 };

  return (
    <motion.div
      ref={ref}
      initial={shouldAnimate ? hiddenState : false}
      animate={shouldAnimate ? (isInView ? visibleState : hiddenState) : undefined}
      transition={
        shouldAnimate
          ? {
              duration,
              delay,
              ease: [0.25, 0.1, 0.25, 1],
            }
          : undefined
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  once = true,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-64px" });
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inViewport) {
        setShouldAnimate(true);
      }
    }
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={shouldAnimate ? "hidden" : false}
      animate={shouldAnimate ? (isInView ? "visible" : "hidden") : undefined}
      variants={
        shouldAnimate
          ? {
              visible: {
                transition: { staggerChildren: staggerDelay },
              },
            }
          : undefined
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
