"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { COACH_GOALS, COACH_STARTERS } from "@/lib/careerotter/coach-prompt";

type Msg = { role: "user" | "assistant"; content: string };

const GOAL_STAGES = [...new Set(COACH_GOALS.map((g) => g.stage))];

// Keep in sync with MAX_MESSAGES in the coach API route.
const MAX_SENT_MESSAGES = 30;

/**
 * Coach chat (M3). Grounded server-side in the user's wins; this is just the
 * transcript + input. Seeded starters get a cold-start user moving. Prior
 * sessions are restored from coach memory so the coach picks up where the
 * user left off.
 */
export function CoachChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [summary, setSummary] = useState("");
  const [restored, setRestored] = useState(false);
  const [loadingMemory, setLoadingMemory] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // The guided activity currently steering the conversation, if any. Sent with
  // every request while active so the coach keeps running that flow.
  const [goalId, setGoalId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/careerotter/coach");
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages(data.messages);
          setSummary(typeof data.summary === "string" ? data.summary : "");
          // Restore the active guided flow too, so the next message keeps
          // running it instead of falling back to the generic prompt.
          setGoalId(typeof data.goalId === "string" ? data.goalId : null);
          setRestored(true);
        }
      } catch {
        // No stored session — start cold.
      } finally {
        if (!cancelled) setLoadingMemory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(text: string, activeGoalId: string | null = goalId) {
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
        body: JSON.stringify({
          messages: next.slice(-MAX_SENT_MESSAGES),
          ...(activeGoalId ? { goalId: activeGoalId } : {}),
        }),
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

  function startGoal(id: string) {
    const goal = COACH_GOALS.find((g) => g.id === id);
    if (!goal) return;
    setGoalId(goal.id);
    send(goal.kickoff, goal.id);
  }

  async function startFresh() {
    // Delete server-side memory first: clearing local state on a failed
    // delete would just resurrect the old session on the next reload.
    try {
      const res = await fetch("/api/careerotter/coach", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      setError("Could not clear the saved session. Try again.");
      return;
    }
    setMessages([]);
    setSummary("");
    setRestored(false);
    setError("");
    setGoalId(null);
  }

  if (loadingMemory) {
    return <Spinner size="sm" />;
  }

  return (
    <div className="space-y-4">
      {restored && (
        <Card className="bg-muted">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">Pick up where you left off</p>
            {summary && (
              <p className="text-sm text-muted-foreground">{summary}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={startFresh}
              disabled={sending}
            >
              Start fresh
            </Button>
          </CardContent>
        </Card>
      )}

      {messages.length === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The coach reasons from what you have logged. Ask anything, or pick a
            guided activity:
          </p>
          <div className="flex flex-col gap-2">
            {COACH_STARTERS.map((s) => (
              <Button
                key={s}
                variant="outline"
                className="min-h-[44px] justify-start text-left"
                onClick={() => send(s)}
                disabled={sending}
              >
                {s}
              </Button>
            ))}
          </div>
          {GOAL_STAGES.map((stage) => (
            <div key={stage} className="space-y-2">
              <h3 className="text-sm font-semibold">{stage}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COACH_GOALS.filter((g) => g.stage === stage).map((g) => (
                  <Button
                    key={g.id}
                    variant="outline"
                    className="h-auto min-h-[44px] flex-col items-start gap-0.5 py-2 text-left"
                    onClick={() => startGoal(g.id)}
                    disabled={sending}
                  >
                    <span className="font-medium">{g.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.description}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
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
