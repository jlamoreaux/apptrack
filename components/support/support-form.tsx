"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { capturePostHogEvent } from "@/lib/analytics/posthog";
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from "@/lib/constants/site-config";

// Mirror the server-side caps in app/api/support/route.ts so the client blocks
// invalid input before a round-trip. Keep these in sync with the route.
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 5000;

const DEFAULT_CATEGORY: SupportCategory = SUPPORT_CATEGORIES[0];

type SubmitStatus = "idle" | "submitting" | "success" | "error";

type SupportFormSource = "nav" | "error_fallback" | "page";

interface SupportFormProps {
  source: SupportFormSource;
  initialContext?: { errorMessage?: string };
  onDone?: () => void;
}

interface SupportRequestBody {
  category: SupportCategory;
  subject: string;
  message: string;
  context: {
    url: string;
    errorMessage?: string;
  };
}

function buildFailureReason(status: number | "network"): string {
  return status === "network" ? "network_error" : `http_${status}`;
}

export function SupportForm({
  source,
  initialContext,
  onDone,
}: SupportFormProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<SupportCategory>(DEFAULT_CATEGORY);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  // Fire the "opened" analytics event exactly once per mount.
  const hasTrackedOpen = useRef(false);
  useEffect(() => {
    if (hasTrackedOpen.current) return;
    hasTrackedOpen.current = true;
    capturePostHogEvent("support_form_opened", { source });
  }, [source]);

  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();
  const isSubjectValid =
    trimmedSubject.length > 0 && subject.length <= SUBJECT_MAX;
  const isMessageValid =
    trimmedMessage.length > 0 && message.length <= MESSAGE_MAX;
  const isSubmitting = status === "submitting";
  const canSubmit = isSubjectValid && isMessageValid && !isSubmitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("submitting");
    setErrorText(null);

    const body: SupportRequestBody = {
      category,
      subject: trimmedSubject,
      message: trimmedMessage,
      context: {
        url: window.location.href,
        ...(initialContext?.errorMessage
          ? { errorMessage: initialContext.errorMessage }
          : {}),
      },
    };

    let response: Response;
    try {
      response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      const reason = buildFailureReason("network");
      capturePostHogEvent("support_request_failed", { reason });
      setStatus("error");
      setErrorText(
        "We couldn't reach support. Check your connection and try again."
      );
      toast({
        title: "Could not send",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!response.ok) {
      const reason = buildFailureReason(response.status);
      capturePostHogEvent("support_request_failed", { reason });
      setStatus("error");
      setErrorText(
        "Something went wrong sending your request. Please try again."
      );
      toast({
        title: "Could not send",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      return;
    }

    capturePostHogEvent("support_request_submitted", { category });
    setStatus("success");
    toast({
      title: "Message sent",
      description: "We received your request and will reply by email.",
    });
    onDone?.();
  }

  if (status === "success") {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="text-sm font-medium text-foreground">
          Thanks, your message was sent.
        </p>
        <p className="text-sm text-muted-foreground">
          Our team will reply to your account email as soon as possible.
        </p>
      </div>
    );
  }

  const subjectRemaining = SUBJECT_MAX - subject.length;
  const messageRemaining = MESSAGE_MAX - message.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="support-category">Category</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as SupportCategory)}
          disabled={isSubmitting}
        >
          <SelectTrigger id="support-category" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-subject">Subject</Label>
        <Input
          id="support-subject"
          value={subject}
          maxLength={SUBJECT_MAX}
          disabled={isSubmitting}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Brief summary of your issue"
          aria-describedby="support-subject-help"
        />
        <p
          id="support-subject-help"
          className="text-xs text-muted-foreground"
        >
          {subjectRemaining} characters remaining
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="support-message">Message</Label>
        <Textarea
          id="support-message"
          value={message}
          maxLength={MESSAGE_MAX}
          disabled={isSubmitting}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what happened and what you expected"
          className="min-h-32"
          aria-describedby="support-message-help"
        />
        <p
          id="support-message-help"
          className="text-xs text-muted-foreground"
        >
          {messageRemaining} characters remaining
        </p>
      </div>

      {errorText ? (
        <p className="text-sm text-destructive" role="alert">
          {errorText}
        </p>
      ) : null}

      <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
        {isSubmitting ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
