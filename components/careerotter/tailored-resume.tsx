"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Per-application tailored resume draft. Generates a rewrite of the user's
 * uploaded resume targeted at this application's saved job description, and
 * shows the latest saved draft on load.
 */
export function TailoredResume({ applicationId }: { applicationId: string }) {
  const [draft, setDraft] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/careerotter/tailored-resume?applicationId=${encodeURIComponent(applicationId)}`
        );
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.tailoredText) {
          setDraft(data.tailoredText);
          setCreatedAt(data.createdAt ?? null);
        }
      } catch {
        // No saved draft — the generate button is the entry point.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function generate() {
    setGenerating(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/careerotter/tailored-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.tailoredText) {
        setDraft(data.tailoredText);
        if (data.persisted) {
          setCreatedAt(new Date().toISOString());
        } else {
          // Generated but not saved — show it so the user can copy it out,
          // with no saved-draft date and a clear warning.
          setCreatedAt(null);
          setError("Draft generated but could not be saved. Copy it now — it will not be here after a reload.");
        }
      } else {
        setError(data?.error || "Could not generate a draft right now.");
      }
    } catch {
      setError("Could not generate a draft right now.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tailored Resume</CardTitle>
        <CardDescription>
          Rewrite your uploaded resume to target this job description. Uses only
          what your resume already says, reordered and reworded for this role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={generating} className="min-h-[44px]">
            {generating ? "Generating…" : draft ? "Regenerate draft" : "Generate draft"}
          </Button>
          {draft && (
            <Button
              variant="outline"
              onClick={copyDraft}
              disabled={generating}
              className="min-h-[44px]"
            >
              {copied ? "Copied" : "Copy draft"}
            </Button>
          )}
          {createdAt && (
            <span className="text-xs text-muted-foreground">
              Draft from{" "}
              {new Date(createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {draft && (
          <pre className="max-h-96 overflow-y-auto rounded-md border bg-muted p-4 text-sm whitespace-pre-wrap font-sans">
            {draft}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
