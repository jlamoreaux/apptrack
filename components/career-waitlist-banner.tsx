"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { CAREER_CAMPAIGN } from "@/lib/constants/career";
import {
  trackCareerBannerClicked,
  trackCareerBannerDismissed,
} from "@/lib/analytics/career-events";

const DISMISS_KEY = "career-waitlist-banner-dismissed";
// The hired banner owns this key (components/hired-subscription-banner.tsx).
// We read it so we only defer to that banner while it is actually visible —
// see hiredBannerEligible below.
const HIRED_DISMISS_KEY = "hired-banner-dismissed";

function getDismissKey(userId: string) {
  return `${DISMISS_KEY}:${userId}`;
}

// localStorage throws in private-mode Safari and storage-disabled webviews.
// Treat any failure as "not dismissed" so the banner still works.
function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(getDismissKey(userId)) === "true";
  } catch {
    return false;
  }
}

function readHiredBannerDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${HIRED_DISMISS_KEY}:${userId}`) === "true";
  } catch {
    return false;
  }
}

function persistDismissed(userId: string) {
  try {
    localStorage.setItem(getDismissKey(userId), "true");
  } catch {
    // Ignore: the banner still dismisses for this session via component state.
  }
}

// Neutral CTA target — deliberately does not pre-answer the positioning
// question (separate mode vs integrated). UTMs identify the in-app banner
// as the traffic source for the Phase 0 gate.
const CAREER_WAITLIST_HREF = `/career?${new URLSearchParams({
  utm_source: "in_app",
  utm_medium: "banner",
  utm_campaign: CAREER_CAMPAIGN,
}).toString()}`;

export function CareerWaitlistBanner({
  userId,
  hiredBannerEligible = false,
}: {
  userId: string;
  /**
   * True when the hired banner is eligible to render (server-computed). We
   * only defer to it while it is *actually* visible — i.e. eligible AND not
   * dismissed — so a hired+paid user who dismisses the hired banner still
   * sees this one instead of being permanently excluded.
   */
  hiredBannerEligible?: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);
  const [hiredBannerVisible, setHiredBannerVisible] = useState(hiredBannerEligible);

  useEffect(() => {
    setDismissed(readDismissed(userId));
    setHiredBannerVisible(
      hiredBannerEligible && !readHiredBannerDismissed(userId)
    );
  }, [userId, hiredBannerEligible]);

  if (hiredBannerVisible || dismissed) {
    return null;
  }

  return (
    <Card className="p-4 rounded-lg bg-muted" role="status">
      <CardContent>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <TrendingUp className="h-5 w-5 text-primary shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">
                Planning your next raise or promotion?
              </p>
              <p className="text-sm text-muted-foreground">
                We&apos;re building a career companion to help you track your
                wins and build the case for your next review.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" className="whitespace-nowrap">
              <Link
                href={CAREER_WAITLIST_HREF}
                onClick={() => trackCareerBannerClicked()}
              >
                Join the waitlist
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss banner"
              onClick={() => {
                persistDismissed(userId);
                setDismissed(true);
                trackCareerBannerDismissed();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
