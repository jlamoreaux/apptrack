"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TryFeature = "job-fit" | "cover-letter" | "interview-prep";

const FEATURE_TO_TAB: Record<TryFeature, string> = {
  "job-fit": "job-fit",
  "cover-letter": "cover-letter",
  "interview-prep": "interview",
};

/**
 * Redirects logged-in users from /try/* pages to the dashboard AI coach
 * Returns true while checking auth, false once check is complete
 */
export function useAuthRedirect(feature: TryFeature): boolean {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const tab = FEATURE_TO_TAB[feature];
          router.replace(`/dashboard/ai-coach?tab=${tab}`);
          return;
        }
      } catch (error) {
        // Ignore auth errors, just show the try page
      }
      setIsChecking(false);
    };

    checkAuth();
  }, [feature, router]);

  return isChecking;
}
