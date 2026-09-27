"use client";

import { useEffect, useRef, useState } from "react";
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
  squareImageUrl: string;
  caption: string;
}

type ShareMethod =
  | "native_share"
  | "copy_link"
  | "copy_caption"
  | "linkedin"
  | "x"
  | "download_story"
  | "download_square";

/** Whether this browser can hand an image file to the OS share sheet (mostly phones). */
function supportsFileSharing(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([""], "probe.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

export function SharePanel({ year, outcomeCompany }: SharePanelProps) {
  const [includeOutcome, setIncludeOutcome] = useState(false);
  const [links, setLinks] = useState<ShareLinks | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [copied, setCopied] = useState<"link" | "caption" | null>(null);
  // Detected after mount: the server cannot know, and guessing would cause a hydration mismatch.
  const [canShareFiles, setCanShareFiles] = useState(false);
  // Only the latest request may set links, so a slow response for an earlier
  // choice can never publish the company after the owner opted out.
  const requestId = useRef(0);

  useEffect(() => {
    setCanShareFiles(supportsFileSharing());
  }, []);

  function track(method: ShareMethod) {
    capturePostHogEvent("year_in_review_share_action", { year, method, include_outcome: includeOutcome });
  }

  async function createLink(nextIncludeOutcome = includeOutcome) {
    const id = ++requestId.current;
    setStatus("loading");
    setCopied(null);
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

  async function copy(kind: "link" | "caption") {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(kind === "link" ? links.url : links.caption);
      setCopied(kind);
      track(kind === "link" ? "copy_link" : "copy_caption");
    } catch {
      setCopied(null);
    }
  }

  async function shareImage() {
    if (!links) return;
    try {
      const response = await fetch(links.storyImageUrl);
      // A failed render must not reach the share sheet as a broken image.
      if (!response.ok) throw new Error(`Story image failed: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], `year-in-review-${year}.png`, { type: "image/png" });
      // Files and a URL together make some apps drop the image, so the link rides in the text.
      await navigator.share({ files: [file], text: `${links.caption} ${links.url}` });
      track("native_share");
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
    }
  }

  const linkedInUrl = links
    ? `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${links.caption}\n\n${links.url}`)}`
    : "";
  const xUrl = links
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(links.caption)}&url=${encodeURIComponent(links.url)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-base font-medium opacity-80 sm:text-lg">Share your year</p>
        <h2 className="text-4xl font-bold">Post it, or keep it</h2>
        <p className="text-lg">
          {outcomeCompany
            ? "A shared link shows your label and totals. Roles, companies and the still-waiting count stay private, unless you choose to include where you landed."
            : "A shared link shows your label and totals. Roles, companies and the still-waiting count stay private."}
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
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {canShareFiles && (
              <Button size="lg" onClick={() => void shareImage()}>
                Share image
              </Button>
            )}
            <Button size="lg" variant={canShareFiles ? "outline" : "default"} onClick={() => void copy("link")}>
              {copied === "link" ? "Link copied" : "Copy link"}
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" onClick={() => track("linkedin")}>
                Post on LinkedIn
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={xUrl} target="_blank" rel="noopener noreferrer" onClick={() => track("x")}>
                Post on X
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-base font-medium">Save the image to post yourself</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="outline" asChild>
                <a href={links.storyImageUrl} download={`year-in-review-${year}-story.png`} onClick={() => track("download_story")}>
                  Story (9:16)
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={links.squareImageUrl} download={`year-in-review-${year}-square.png`} onClick={() => track("download_square")}>
                  Feed post (square)
                </a>
              </Button>
              <Button size="lg" variant="outline" onClick={() => void copy("caption")}>
                {copied === "caption" ? "Caption copied" : "Copy caption"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="text-base">
        {status === "error" ? "Something went wrong while sharing. Try again in a moment." : ""}
      </p>
    </div>
  );
}
