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
                <h3 className="font-bold text-lg text-green-900 dark:text-green-100">Trial Activated Successfully! 🎉</h3>
                <p className="text-green-800 dark:text-green-200 mt-1">
                  Check your email for details about your trial duration and features. You now have access to all AI-powered tools!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      <Card className="border-2 border-purple-500/20 dark:border-purple-400/30 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 dark:from-purple-500/5 dark:via-blue-500/5 dark:to-purple-500/5 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-500/10 dark:bg-purple-400/10 rounded-full">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-foreground">Limited Time Offer</h3>
                  <p className="text-sm text-purple-700 dark:text-purple-400 font-medium">90-Day AI Coach Trial</p>
                </div>
              </div>
            
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Get full access to AI-powered resume analysis, interview prep, and career coaching.
              </p>
              
              <div className="bg-background/60 border border-border rounded-lg p-3 mb-4">
                <p className="text-sm text-foreground">
                  <strong className="text-purple-600 dark:text-purple-400">✓ No credit card required</strong><br/>
                  <strong className="text-purple-600 dark:text-purple-400">✓ Trial duration varies by promo code</strong><br/>
                  <strong className="text-purple-600 dark:text-purple-400">✓ Automatic downgrade after trial expires</strong>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
                <Input
                  placeholder="Enter promo code (e.g., AICOACH90)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                  disabled={loading}
                  className="bg-background border-input focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400 text-base"
                />
                <Button 
                  onClick={handleActivate} 
                  disabled={loading || !promoCode.trim()}
                  className="bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-800 hover:to-blue-800 dark:from-purple-600 dark:to-blue-600 dark:hover:from-purple-700 dark:hover:to-blue-700 text-white font-semibold px-6 py-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Activating...
                    </>
                  ) : (
                    "Activate Trial"
                  )}
                </Button>
              </div>

              {error && (
                <div className="mt-4 p-3 border border-destructive/50 bg-destructive/10 dark:bg-destructive/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                <span>You'll receive email reminders before your trial expires</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBanner(false)}
              className="ml-4 hover:bg-background/50 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}