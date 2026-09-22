"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { importGuestComp } from "@/lib/careerotter/comp-guest-import";
import { COMP_AFTER_AUTH_PATH } from "./guest-save-prompt";

/**
 * Runs once per app-shell mount: if the browser holds comp entries from a
 * visit before signing up, save them to the account and say so. Renders
 * nothing. Safe to mount alongside the comp page, which shares the same
 * single in-flight import.
 */
export function GuestCompImport() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    importGuestComp().then((result) => {
      if (cancelled || !result || result.imported === 0) return;
      const noun = result.imported === 1 ? "entry" : "entries";
      toast({
        title: `Saved ${result.imported} comp ${noun} from your visit`,
        description:
          pathname === COMP_AFTER_AUTH_PATH
            ? "They are in your account now."
            : "They are in your account now, under Comp.",
        action:
          pathname === COMP_AFTER_AUTH_PATH ? undefined : (
            <ToastAction altText="Open comp" onClick={() => router.push(COMP_AFTER_AUTH_PATH)}>
              Open comp
            </ToastAction>
          ),
      });
    });
    return () => {
      cancelled = true;
    };
    // Once per mount: the cache is what decides whether there is work to do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
