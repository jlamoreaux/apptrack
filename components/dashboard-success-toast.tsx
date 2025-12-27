"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

/**
 * Client component to handle success toasts on the dashboard
 * Reads URL parameters and displays appropriate success messages
 */
export function DashboardSuccessToast() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const upgradeSuccess = searchParams.get("upgrade_success");
    const message = searchParams.get("message");

    if (upgradeSuccess === "true" && message) {
      const decodedMessage = decodeURIComponent(message);
      
      toast({
        title: "🎉 Upgrade Successful!",
        description: decodedMessage,
        duration: 6000, // Show for 6 seconds
        className: "bg-green-50 border-green-200",
      });

      // Clean up URL after showing toast
      const url = new URL(window.location.href);
      url.searchParams.delete("upgrade_success");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams, toast]);

  return null;
}