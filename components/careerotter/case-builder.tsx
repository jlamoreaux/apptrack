"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Copy, Download, Printer } from "lucide-react";

/**
 * Case builder (M4). Generates a review-ready case from the user's logged wins
 * and offers the three exports the PRD asks for: copy-to-clipboard, download
 * (markdown), and print (browser "Save as PDF"). The document is the user's, so
 * it renders plainly with no otter chrome.
 */
export function CaseBuilder() {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/careerotter/case", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.markdown) {
        setMarkdown(data.markdown);
      } else {
        setError(data?.error || "Could not build your case right now.");
      }
    } catch {
      setError("Could not build your case right now.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-case.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={loading}>
          {loading ? <Spinner size="sm" className="mr-2" /> : null}
          {markdown ? "Rebuild case" : "Build my case"}
        </Button>
        {markdown && (
          <>
            <Button variant="outline" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" onClick={download}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print / PDF
            </Button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {markdown && (
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-6">
            {/* The document is the user's; render it plainly. */}
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {markdown}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
