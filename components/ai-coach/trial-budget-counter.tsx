"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { TrialBudgetState } from "@/types";

interface TrialBudgetCounterProps {
  budget: TrialBudgetState;
  loading?: boolean;
}

/**
 * Persistent counter badge shown near submit buttons on AI tool pages.
 * Shows "X of 5 free analyses remaining" for free users.
 * Shows "Upgrade to unlock" when budget is exhausted.
 * Hidden for Pro users.
 */
export function TrialBudgetCounter({ budget, loading }: TrialBudgetCounterProps) {
  if (loading || budget.is_pro) return null;

  if (budget.analyses_remaining <= 0) {
    return (
      <Button asChild size="sm" className="h-11 px-4">
        <Link href="/dashboard/upgrade?highlight=ai-coach">
          Upgrade to unlock
        </Link>
      </Button>
    );
  }

  return (
    <Badge
      variant={budget.analyses_remaining <= 1 ? "destructive" : "outline"}
      className="text-xs whitespace-nowrap"
    >
      {budget.analyses_remaining} of {budget.analyses_limit} free analyses remaining
    </Badge>
  );
}
