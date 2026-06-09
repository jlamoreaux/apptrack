"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import { CONVERSION_EVENTS } from "@/lib/analytics/conversion-events";

type ImportMethod = "url_paste" | "manual";

/**
 * Guided first-job import (retention Phase 1). Lets a new user populate their
 * pipeline before reaching the empty dashboard, via URL extraction or quick
 * manual entry, then surfaces a one-off AI Coach insight (Phase 3, Option A).
 */
export function FirstJobStep() {
  const router = useRouter();

  const [method, setMethod] = useState<ImportMethod>("url_paste");
  // The tab (`method`) flips to "manual" after a successful extraction so the
  // user can confirm pre-filled fields — so it can't be used to report how the
  // job was actually imported. Track that separately.
  const [importSource, setImportSource] = useState<ImportMethod>("manual");
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [roleLink, setRoleLink] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);

  async function handleExtract() {
    if (!url.trim()) return;
    setExtracting(true);
    setError(null);
    capturePostHogEvent(CONVERSION_EVENTS.ONBOARDING_JOB_IMPORT_STARTED, { method: "url_paste" });

    try {
      const res = await fetch("/api/onboarding/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        // Fall back to manual entry; keep whatever the user typed.
        setMethod("manual");
        setRoleLink(url.trim());
        setError("We couldn't read that posting. Please fill in the details below.");
        return;
      }

      const { job } = await res.json();
      setCompany(job.company ?? "");
      setRole(job.title ?? "");
      setRoleLink(job.posting_url ?? url.trim());
      setJobDescription(job.description_summary ?? "");
      setImportSource("url_paste");
      setMethod("manual"); // reveal the pre-filled, editable form for confirmation
    } catch {
      setMethod("manual");
      setRoleLink(url.trim());
      setError("Something went wrong. Please enter the details below.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!company.trim() || !role.trim()) {
      setError("Company and role are required.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          role: role.trim(),
          role_link: roleLink.trim() || null,
          job_description: jobDescription.trim() || null,
          date_applied: new Date().toISOString().slice(0, 10),
          status: "Applied",
        }),
      });

      if (!res.ok) {
        setError("Could not save the job. Please try again.");
        return;
      }

      capturePostHogEvent(CONVERSION_EVENTS.ONBOARDING_JOB_IMPORT_COMPLETED, {
        method: importSource,
        extraction_success: importSource === "url_paste",
      });

      // Phase 3 anchor: fetch a one-off coach insight (non-blocking for the save).
      // Track the result in a local var — `insight` state won't update until the
      // next render, so we can't rely on it to decide navigation here.
      let shownInsight: string | null = null;
      try {
        const insightRes = await fetch("/api/onboarding/coach-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: company.trim(),
            role: role.trim(),
            jobDescription: jobDescription.trim() || undefined,
          }),
        });
        if (insightRes.ok) {
          const { insight: text } = await insightRes.json();
          if (text) {
            shownInsight = text;
            setInsight(text);
            capturePostHogEvent(CONVERSION_EVENTS.AI_COACH_ONBOARDING_SHOWN);
          }
        }
      } catch {
        // Insight is a bonus; never block completion on it.
      }

      if (!shownInsight) {
        // No insight to show — go straight to the dashboard.
        router.push("/dashboard");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    capturePostHogEvent(CONVERSION_EVENTS.ONBOARDING_JOB_IMPORT_SKIPPED);
    router.push("/dashboard");
  }

  function handleCoachCta() {
    capturePostHogEvent(CONVERSION_EVENTS.AI_COACH_ONBOARDING_CTA_CLICKED);
    router.push("/dashboard/ai-coach");
  }

  // Post-save state: show the AI Coach insight with next-step CTAs.
  if (insight) {
    return (
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Your first job is tracked</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium text-foreground mb-1">AI Coach</p>
            <p className="text-sm text-muted-foreground">{insight}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleCoachCta} className="min-h-[44px] flex-1">
              Try the AI Coach
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="min-h-[44px] flex-1"
            >
              Go to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Add your first job</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={method} onValueChange={(v) => setMethod(v as ImportMethod)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url_paste" className="min-h-[44px]">
              Paste a link
            </TabsTrigger>
            <TabsTrigger value="manual" className="min-h-[44px]">
              Enter manually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url_paste" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="job-url">Job posting URL</Label>
              <Input
                id="job-url"
                type="url"
                inputMode="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Works with LinkedIn, Indeed, Greenhouse, Lever, and most job boards.
              </p>
            </div>
            <Button
              onClick={handleExtract}
              disabled={extracting || !url.trim()}
              className="min-h-[44px] w-full"
            >
              {extracting ? "Reading posting..." : "Fetch details"}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Senior Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-link">Job link (optional)</Label>
              <Input
                id="role-link"
                type="url"
                value={roleLink}
                onChange={(e) => setRoleLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-description">Description (optional)</Label>
              <Textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !company.trim() || !role.trim()}
              className="min-h-[44px] w-full"
            >
              {saving ? "Saving..." : "Save and continue"}
            </Button>
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={handleSkip}
          className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      </CardContent>
    </Card>
  );
}
