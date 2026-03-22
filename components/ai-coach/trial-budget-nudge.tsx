"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import type { TrialBudgetState } from "@/types";

interface TrialBudgetNudgeProps {
  budget: TrialBudgetState;
  onDismiss?: () => void;
}

/**
 * Escalating post-result nudge banners and last-use modal.
 *
 * - Uses 1-3: subtle inline banner
 * - Use 4: prominent banner
 * - Use 5 (last): modal
 *
 * Only renders after an analysis completes. Hidden for Pro users.
 */
export function TrialBudgetNudge({ budget, onDismiss }: TrialBudgetNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const modalShownRef = useRef(false);

  const remaining = budget.analyses_remaining;
  const used = budget.analyses_used;

  // Fire modal-shown event exactly once
  useEffect(() => {
    if (remaining <= 0 && used > 0 && !budget.is_pro && !modalShownRef.current) {
      modalShownRef.current = true;
      capturePostHogEvent("ai_trial_upgrade_modal_shown");
    }
  }, [remaining, used, budget.is_pro]);

  if (budget.is_pro || dismissed) return null;

  // No nudge needed if budget hasn't been touched
  if (used === 0) return null;

  const handleUpgradeClick = (source: string) => {
    capturePostHogEvent("ai_trial_upgrade_clicked", { source });
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Last-use modal (all 5 used)
  if (remaining <= 0) {
    return (
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>That was your last free analysis.</DialogTitle>
            <DialogDescription>
              You&apos;ve used Job Fit, Interview Prep, and Cover Letter. Pro
              gives you unlimited access to all three — for $10/month.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button asChild onClick={() => handleUpgradeClick("modal")}>
              <Link href="/dashboard/upgrade?highlight=ai-coach">
                Upgrade to Pro
              </Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setModalOpen(false); onDismiss?.(); }}
            >
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Prominent banner (1 remaining — 4th use)
  if (remaining === 1) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30 px-4 py-3 mt-4">
        <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
          1 analysis remaining — make it count, or{" "}
          <Link
            href="/dashboard/upgrade?highlight=ai-coach"
            className="underline font-semibold"
            onClick={() => handleUpgradeClick("banner")}
          >
            upgrade for unlimited
          </Link>
          .
        </p>
        <button
          onClick={handleDismiss}
          className="text-orange-600 hover:text-orange-800 dark:text-orange-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Subtle banner (2+ remaining — uses 1-3)
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 mt-4">
      <p className="text-sm text-muted-foreground">
        {remaining} analyses remaining —{" "}
        <Link
          href="/dashboard/upgrade?highlight=ai-coach"
          className="underline"
          onClick={() => handleUpgradeClick("banner")}
        >
          upgrade for unlimited access
        </Link>
        .
      </p>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
