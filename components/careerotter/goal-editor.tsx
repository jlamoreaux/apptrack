"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAREER_MODE_OPTIONS,
  type CareerMode,
} from "@/lib/constants/careerotter";

export interface CareerGoal {
  mode: CareerMode | null;
  role: string | null;
  level: string | null;
  target: string | null;
  review_date: string | null;
}

/**
 * The goal frame, editable. Everything on Today counts down to it, so it has to
 * keep pace with a changed review date or a new job. Free: no model call, one
 * PATCH.
 *
 * Rendered as a dialog around a caller-supplied trigger, so every entry point
 * opens the same form.
 */
export function GoalEditor({
  goal,
  onSaved,
  trigger,
  title = "Your goal",
  description = "Everything on Today counts down to this. Change it whenever it changes.",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  goal: CareerGoal;
  onSaved: (goal: CareerGoal) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const [mode, setMode] = useState<CareerMode>(goal.mode ?? "promotion");
  const [role, setRole] = useState(goal.role ?? "");
  const [level, setLevel] = useState(goal.level ?? "");
  const [target, setTarget] = useState(goal.target ?? "");
  const [reviewDate, setReviewDate] = useState(goal.review_date ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // What the form was prefilled with. Saving diffs against this and sends only
  // the changed fields, so a prefill that arrived empty — which is what a failed
  // or timed-out dashboard read looks like — cannot write nulls over stored
  // values. An untouched field is never sent.
  const prefill = useRef(goal);

  // Reset the form to the stored goal each time it opens, so a cancelled edit
  // doesn't persist as ghost state in the next one.
  useEffect(() => {
    if (!open) return;
    prefill.current = goal;
    setMode(goal.mode ?? "promotion");
    setRole(goal.role ?? "");
    setLevel(goal.level ?? "");
    setTarget(goal.target ?? "");
    setReviewDate(goal.review_date ?? "");
    setError("");
  }, [open, goal]);

  async function save() {
    const before = prefill.current;
    const text = (value: string) => value.trim() || null;

    // Only the dirty fields. An unstored `mode` is deliberately not sent: the
    // column is NOT NULL DEFAULT 'promotion', so an insert without it lands on
    // the same value the select was showing, and a stored mode we failed to
    // read survives instead of being reset.
    const changes: Record<string, string | null> = {};
    if (mode !== (before.mode ?? "promotion")) changes.mode = mode;
    if (text(role) !== before.role) changes.role = text(role);
    if (text(level) !== before.level) changes.level = text(level);
    if (text(target) !== before.target) changes.target = text(target);
    if ((reviewDate || null) !== before.review_date) {
      changes.review_date = reviewDate || null;
    }

    // Nothing to write. The route rejects an empty patch, and asking it to is
    // just a round trip to be told so.
    if (Object.keys(changes).length === 0) {
      setOpen(false);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/careerotter/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Could not save that. Try again.");
        return;
      }
      const { profile } = await res.json();
      // Trust the row that came back: it carries the fields this patch did not
      // touch, which the caller's copy of the goal may be missing.
      onSaved({
        mode: profile?.mode ?? mode,
        role: profile?.role ?? null,
        level: profile?.level ?? null,
        target: profile?.target ?? null,
        review_date: profile?.review_date ?? null,
      });
      setOpen(false);
    } catch {
      setError("Could not save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = mode === "job_search" ? "Target date" : "Review date";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="goal-mode">What are you working toward?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as CareerMode)}>
              <SelectTrigger id="goal-mode" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAREER_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goal-role">Your role</Label>
              <Input
                id="goal-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Software Engineer"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-level">Level</Label>
              <Input
                id="goal-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="Senior"
                className="min-h-[44px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-target">The ask</Label>
            <Input
              id="goal-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Staff Engineer"
              className="min-h-[44px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-review-date">{dateLabel}</Label>
            <Input
              id="goal-review-date"
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="min-h-[44px]"
            />
            <p className="text-xs text-muted-foreground">
              An approximate date is fine. You can move it later.
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="min-h-[44px]">
            {saving ? <Spinner size="sm" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
