import { cn } from "@/lib/utils";

/**
 * CareerOtter mark — the otter floating on its back with an amber rock on its
 * chest (the signature pose from the brand guide / redesign). One asset only per
 * the Phase 2 production bar. Uses `currentColor` for the line work so it adapts
 * to light/dark; the rock is always the amber accent (the one warm point).
 *
 * Renders at 120x68 intrinsic ratio. Size it with width/height or className.
 */
export function CareerOtterLogo({
  className,
  decorative = false,
  title = "CareerOtter",
  width = 34,
  height = 19,
}: {
  className?: string;
  // When adjacent text already names the brand, mark the mark decorative so
  // screen readers don't announce "CareerOtter" twice.
  decorative?: boolean;
  title?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 68"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative || undefined}
      className={cn("text-foreground", className)}
    >
      <g
        stroke="currentColor"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="24" cy="32" r="10" />
        <path d="M33,36 Q42,26 56,25 Q74,24 84,30 Q92,34 97,32 Q104,29 103,23 M97,32 Q99,38 92,41 Q75,48 52,46 Q38,44 33,38" />
      </g>
      {/* The rock: always amber (#D97E1F), the brand's confident signal color. */}
      <ellipse
        cx="56"
        cy="19.5"
        rx="9"
        ry="6.5"
        fill="#D97E1F"
        transform="rotate(-6 56 19.5)"
      />
    </svg>
  );
}
