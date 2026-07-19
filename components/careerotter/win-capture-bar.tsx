"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";
import { trackWinLogged } from "@/lib/analytics/careerotter-events";

export interface LoggedWin {
  id: string;
  text: string;
  impact_number: string | null;
  tag: WinTag | null;
  source: string;
  created_at: string;
  edited_at: string | null;
}

/**
 * The capture bar: one line, ten seconds, raw notes are fine (brand guide). Tag
 * is optional. Logging is free — this calls the model nowhere. On success it
 * hands the new win up so the list and coverage meter update without a refetch.
 */
export function WinCaptureBar({
  onLogged,
}: {
  onLogged?: (win: LoggedWin) => void;
}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Type what you shipped first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, tag: tag || undefined }),
      });
      if (res.ok) {
        const { win } = await res.json();
        trackWinLogged({ tag: tag || "untagged", source: "manual" });
        setText("");
        setTag("");
        onLogged?.(win);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error || "Could not log that. Try again.");
    } catch {
      setError("Could not log that. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {/* Width lives on the wrapper divs, not the shadcn components: the Input's
          flex-1 was being starved by SelectTrigger's built-in w-full at sm+, which
          collapsed the text field. Wrapping isolates each control's sizing. */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="w-full sm:flex-1 sm:min-w-0">
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
            }}
            placeholder="What did you ship? One line is enough."
            disabled={submitting}
            aria-label="Log a win"
            className="min-h-[44px] w-full"
          />
        </div>
        <div className="w-full sm:w-44 sm:shrink-0">
          <Select value={tag} onValueChange={setTag} disabled={submitting}>
            <SelectTrigger
              className="min-h-[44px] w-full"
              aria-label="Impact area (optional)"
            >
              <SelectValue placeholder="Area (optional)" />
            </SelectTrigger>
            <SelectContent>
              {WIN_TAG_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] w-full sm:w-28 sm:shrink-0"
        >
          {submitting ? <Spinner size="sm" /> : "Log it"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
