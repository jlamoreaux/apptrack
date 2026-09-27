"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { capturePostHogEvent } from "@/lib/analytics/posthog";

interface SharePanelProps {
  year: number;
  /** Company joined this year, if any. Only published when the owner opts in. */
  outcomeCompany: string | null;
}

interface ShareLinks {
  url: string;
  storyImageUrl: string;
}

export function SharePanel({ year, outcomeCompany }: SharePanelProps) {
  const [includeOutcome, setIncludeOutcome] = useState(false);
  const [links, setLinks] = useState<ShareLinks | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [copied, setCopied] = useState(false);
  // Only the latest request may set links, so a slow response for an earlier
  // choice can never publish the company after the owner opted out.
  const requestId = useRef(0);

  async function createLink(nextIncludeOutcome = includeOutcome) {
    const id = ++requestId.current;
    setStatus("loading");
    setCopied(false);
    try {
      const response = await fetch("/api/year-in-review/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, includeOutcome: nextIncludeOutcome }),
      });
      if (!response.ok) throw new Error(`Share request failed: ${response.status}`);
      const next = (await response.json()) as ShareLinks;
      if (id !== requestId.current) return;
      setLinks(next);
      setStatus("idle");
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  }

  function toggleOutcome(checked: boolean) {
    setIncludeOutcome(checked);
    // An existing link encodes the old choice: drop it before minting a new one.
    if (links) {
      setLinks(null);
      void createLink(checked);
    }
  }

  async function copyLink() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.url);
      setCopied(true);
      capturePostHogEvent("year_in_review_link_copied", { year });
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-base font-medium opacity-80 sm:text-lg">Share your year</p>
        <h2 className="text-4xl font-bold">Post it, or keep it</h2>
        <p className="text-lg">
          A shared link shows your label and totals. Roles, companies and the still-waiting count stay private, unless you choose to include where you landed.
        </p>
      </div>

      {outcomeCompany && (
        <div className="flex min-h-11 items-center gap-3">
          <Switch
            id="yir-include-outcome"
            checked={includeOutcome}
            onCheckedChange={toggleOutcome}
            disabled={status === "loading"}
          />
          <Label htmlFor="yir-include-outcome" className="text-base">
            {`Include that I landed at ${outcomeCompany}`}
          </Label>
        </div>
      )}

      {!links && (
        <Button size="lg" onClick={() => void createLink()} disabled={status === "loading"}>
          {status === "loading" ? "Creating link..." : "Create share link"}
        </Button>
      )}

      {links && (
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => void copyLink()} disabled={status === "loading"}>
            {copied ? "Link copied" : "Copy link"}
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(links.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => capturePostHogEvent("year_in_review_linkedin_clicked", { year })}
            >
              Share on LinkedIn
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href={links.storyImageUrl}
              download={`year-in-review-${year}.png`}
              onClick={() => capturePostHogEvent("year_in_review_image_downloaded", { year })}
            >
              Download story image
            </a>
          </Button>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-base">
        {status === "error" ? "Could not create a share link. Try again in a moment." : ""}
      </p>
    </div>
  );
}
