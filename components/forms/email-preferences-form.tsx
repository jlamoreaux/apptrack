"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailPreferences } from "@/lib/email/preferences";

const CATEGORY_ROWS: {
  key: keyof EmailPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "drip_enabled",
    label: "Tips and onboarding",
    description: "Occasional emails to help you get the most out of AppTrack",
  },
  {
    key: "reminders_enabled",
    label: "Application reminders",
    description: "A nudge when applications have gone a while without a status update",
  },
  {
    key: "digest_enabled",
    label: "Weekly pipeline digest",
    description: "A Monday summary of your active applications with an AI Coach insight",
  },
];

export function EmailPreferencesForm() {
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof EmailPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/email/preferences")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load failed"))))
      .then((data) => {
        if (!cancelled) setPrefs(data.preferences);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(key: keyof EmailPreferences, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    // Optimistic update; revert if the save fails.
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    setError(null);

    try {
      const res = await fetch("/api/email/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setPrefs(data.preferences);
    } catch {
      setPrefs(previous);
      setError("Could not save your preference. Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  if (loadFailed) {
    return (
      <p className="text-sm text-muted-foreground">
        Email preferences are unavailable right now. Please try again later.
      </p>
    );
  }

  if (!prefs) {
    return (
      <div className="space-y-4">
        {CATEGORY_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 min-h-[44px]">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const paused = prefs.unsubscribed_all;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {CATEGORY_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 min-h-[44px]">
            <div className="space-y-0.5">
              <Label htmlFor={row.key} className={paused ? "text-muted-foreground" : ""}>
                {row.label}
              </Label>
              <p className="text-sm text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              id={row.key}
              checked={prefs[row.key] && !paused}
              disabled={paused || savingKey !== null}
              onCheckedChange={(checked) => handleToggle(row.key, checked)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 min-h-[44px] border-t pt-4">
        <div className="space-y-0.5">
          <Label htmlFor="unsubscribed_all">Pause all marketing email</Label>
          <p className="text-sm text-muted-foreground">
            Overrides the categories above. You will still receive transactional emails about
            your account.
          </p>
        </div>
        <Switch
          id="unsubscribed_all"
          checked={paused}
          disabled={savingKey !== null}
          onCheckedChange={(checked) => handleToggle("unsubscribed_all", checked)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
