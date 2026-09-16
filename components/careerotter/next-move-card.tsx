"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { NextMove } from "@/lib/careerotter/next-move";

/**
 * The one thing Today asks for. Deliberately a single action: a page that
 * offers five equal options is a page that answers nobody's "what now".
 *
 * "capture" and "goal" moves are handled by the parent (focus the capture bar,
 * open the goal editor) instead of navigating — both are ten-second actions.
 */
export function NextMoveCard({
  move,
  onCapture,
  onEditGoal,
}: {
  move: NextMove;
  onCapture: () => void;
  onEditGoal: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your next move
          </p>
          <h2 className="text-lg font-semibold leading-snug">{move.title}</h2>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {move.detail}
        </p>

        {move.action.kind === "link" ? (
          <Button asChild className="min-h-[44px]">
            <Link href={move.action.href}>
              {move.action.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button
            className="min-h-[44px]"
            onClick={move.action.kind === "capture" ? onCapture : onEditGoal}
          >
            {move.action.cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
