"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type TryFeature = "job-fit" | "cover-letter" | "interview-prep";

const FEATURE_TO_TAB: Record<TryFeature, string> = {
  "job-fit": "job-fit",
  "cover-letter": "cover-letter",
  "interview-prep": "interview",
};

/**
 * Redirects logged-in users from /try/* pages to the dashboard AI coach.
 * Anonymous users are never redirected — /try/* pages are explicitly
 * free-for-anonymous, so this hook resolves immediately when no session
 * exists instead of blocking on a slow auth check.
 *
 * Returns true while checking auth, false once check is complete.
 */
export function useAuthRedirect(feature: TryFeature): boolean {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Only redirect if there is an active session (logged-in user).
        // Anonymous visitors should always see the /try/* page.
        if (!cancelled && session?.user) {
          const tab = FEATURE_TO_TAB[feature];
          router.replace(`/dashboard/ai-coach?tab=${tab}`);
          return;
        }
      } catch (error) {
        // Ignore auth errors — just show the try page for anonymous users
      }
      if (!cancelled) {
        setIsChecking(false);
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [feature, router]);

  return isChecking;
}
