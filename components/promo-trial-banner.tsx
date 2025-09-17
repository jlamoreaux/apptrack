"use client";

import { useState } from "react";
import { X, Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PromoTrialBannerProps {
  onActivate?: () => void;
}

export function PromoTrialBanner({ onActivate }: PromoTrialBannerProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!showBanner || success) return null;

  const handleActivate = async () => {
    if (!promoCode.trim()) {
      setError("Please enter a promo code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/promo/activate-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to activate trial");
      } else {
        setSuccess(true);
        onActivate?.();

        // Show success message then hide banner
        setTimeout(() => setShowBanner(false), 5000);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative">
        <Card className="border-2 border-green-500/20 dark:border-green-400/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 dark:bg-green-400/10 rounded-full">
                <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-green-900 dark:text-green-100">
                  Promo Code Applied Successfully! 🎉
                </h3>
                <p className="text-green-800 dark:text-green-200 mt-1">
                  Your promo code has been activated. Check your email for details about your benefits.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative px-4 sm:px-0">
      <Card className="border-2 border-purple-500/20 dark:border-purple-400/30 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 dark:from-purple-500/5 dark:via-blue-500/5 dark:to-purple-500/5 shadow-lg">
        <CardContent className="p-4 relative">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-purple-500/10 dark:bg-purple-400/10 rounded-full flex-shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-foreground">
                  Have a Promo Code?
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Enter your code below to activate special offers
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Input
                placeholder="Enter your promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                disabled={loading}
                className="bg-background border-input focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400 flex-1"
              />
              <Button
                onClick={handleActivate}
                disabled={loading || !promoCode.trim()}
                className="bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-800 hover:to-blue-800 dark:from-purple-600 dark:to-blue-600 dark:hover:from-purple-700 dark:hover:to-blue-700 text-white font-semibold px-4 sm:px-6 shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Activating...
                  </>
                ) : (
                  "Apply Code"
                )}
              </Button>
            </div>

            {error && (
              <div className="p-2.5 border border-destructive/50 bg-destructive/10 dark:bg-destructive/5 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                  <p className="text-destructive text-xs sm:text-sm">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Close button positioned absolutely */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBanner(false)}
            className="absolute top-2 right-2 hover:bg-background/50 text-muted-foreground hover:text-foreground"
            aria-label="Close banner"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
