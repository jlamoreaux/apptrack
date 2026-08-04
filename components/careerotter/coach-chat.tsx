"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { COACH_STARTERS } from "@/lib/careerotter/coach-prompt";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Coach chat (M3). Grounded server-side in the user's wins; this is just the
 * transcript + input. Seeded starters get a cold-start user moving.
 */
export function CoachChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError("");
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/careerotter/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setError(data?.error || "The coach is unavailable right now.");
      }
    } catch {
      setError("The coach is unavailable right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The coach reasons from what you have logged. Start here:
          </p>
          <div className="flex flex-col gap-2">
            {COACH_STARTERS.map((s) => (
              <Button
                key={s}
                variant="outline"
                className="justify-start text-left"
                onClick={() => send(s)}
                disabled={sending}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "text-right" : ""}>
            <Card
              className={
                m.role === "user" ? "inline-block bg-muted" : "inline-block"
              }
            >
              <CardContent className="p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {m.content}
              </CardContent>
            </Card>
          </li>
        ))}
        {sending && (
          <li>
            <Spinner size="sm" />
          </li>
        )}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach about your case…"
          disabled={sending}
          className="min-h-[44px] flex-1"
          aria-label="Message the coach"
        />
        <Button type="submit" disabled={sending || !input.trim()} className="min-h-[44px]">
          Send
        </Button>
      </form>
    </div>
  );
}
