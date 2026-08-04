"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CAREER_MODE_OPTIONS, type CareerMode } from "@/lib/constants/careerotter";
import { trackZeroToCaseStarted } from "@/lib/analytics/careerotter-events";

/**
 * Zero to Case onboarding (M2c). Three questions, about two minutes, and the AI
 * drafts a starter case from what the user already remembers. They leave with a
 * real document, not an empty journal (RFC §6). Skippable, but the skip is quiet.
 */
export function ZeroToCaseFlow({ prefillReviewDate }: { prefillReviewDate?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<CareerMode>("promotion");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("");
  const [reviewDate, setReviewDate] = useState(prefillReviewDate ?? "");
  const [wins, setWins] = useState(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [starterCase, setStarterCase] = useState("");

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    trackZeroToCaseStarted({ mode });
  }, [mode]);

  async function finish() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/careerotter/zero-to-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          role: role || undefined,
          level: level || undefined,
          review_date: reviewDate || undefined,
          wins: wins.map((w) => w.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.starterCase) {
        setStarterCase(data.starterCase);
        setStep(3);
      } else {
        setError(data?.error || "Could not build your starter case. Try again.");
      }
    } catch {
      setError("Could not build your starter case. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 3 && starterCase) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Here's your starter case.</h2>
        <Card>
          <CardContent className="p-6">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {starterCase}
            </pre>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/dashboard/wins")}>
            Go to my wins
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/review-prep")}>
            Build the full case
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">What are you working toward?</h2>
          <div className="grid gap-2">
            {CAREER_MODE_OPTIONS.map((o) => (
              <Button
                key={o.value}
                variant={mode === o.value ? "default" : "outline"}
                className="justify-start"
                onClick={() => setMode(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <Button onClick={() => setStep(1)}>Next</Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">A little about your role.</h2>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={role} onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Engineer" className="min-h-[44px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="level">Level / years in it</Label>
              <Input id="level" value={level} onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. 3 years" className="min-h-[44px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rd">Next review (optional)</Label>
              <Input id="rd" type="date" value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)} className="min-h-[44px]" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Name up to three things you shipped or fixed recently.
          </h2>
          <p className="text-sm text-muted-foreground">
            Rough notes are fine. The AI shapes them into evidence.
          </p>
          {wins.map((w, i) => (
            <Input
              key={i}
              value={w}
              onChange={(e) => {
                const next = [...wins];
                next[i] = e.target.value;
                setWins(next);
              }}
              placeholder={`Win ${i + 1}`}
              className="min-h-[44px]"
            />
          ))}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
              Back
            </Button>
            <Button onClick={finish} disabled={submitting}>
              {submitting ? <><Spinner size="sm" className="mr-2" />Building…</> : "Build my starter case"}
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/dashboard/wins")}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Skip for now
      </button>
    </div>
  );
}
