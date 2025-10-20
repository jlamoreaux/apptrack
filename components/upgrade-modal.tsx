"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UpgradeBenefits } from "./upgrade-benefits";
import { Sparkles, ArrowRight } from "lucide-react";
import { trackConversionEvent } from "@/lib/analytics/conversion-events";
import { BILLING_CYCLES } from "@/lib/constants/plans";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  title?: string;
  description?: string;
}

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  title = "Unlock AI-Powered Career Coaching",
  description = "Take your job search to the next level with our AI Career Coach",
}: UpgradeModalProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(BILLING_CYCLES.MONTHLY);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const monthlyPrice = 9;
  const yearlyPrice = 90;
  const yearlySavings = (monthlyPrice * 12) - yearlyPrice;

  const handleUpgrade = () => {
    setLoading(true);
    trackConversionEvent("upgrade_modal_clicked", {
      feature: feature || "general",
      billingCycle,
      location: window.location.pathname,
    });
    
    // Navigate to checkout with selected billing cycle
    router.push(`/dashboard/upgrade?billing=${billingCycle}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-secondary" />
            </div>
            <Badge variant="secondary">Limited Time: Save ${yearlySavings}/year</Badge>
          </div>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={billingCycle === BILLING_CYCLES.MONTHLY ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle(BILLING_CYCLES.MONTHLY)}
              className="min-w-[100px]"
            >
              Monthly
            </Button>
            <Button
              variant={billingCycle === BILLING_CYCLES.YEARLY ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle(BILLING_CYCLES.YEARLY)}
              className="min-w-[100px]"
            >
              Yearly
              <Badge variant="secondary" className="ml-2">Save {Math.round((yearlySavings / (monthlyPrice * 12)) * 100)}%</Badge>
            </Button>
          </div>

          {/* Price Display */}
          <div className="text-center py-4">
            <div className="text-4xl font-bold">
              ${billingCycle === BILLING_CYCLES.MONTHLY ? monthlyPrice : yearlyPrice}
              <span className="text-lg font-normal text-muted-foreground">
                /{billingCycle === BILLING_CYCLES.MONTHLY ? "month" : "year"}
              </span>
            </div>
            {billingCycle === BILLING_CYCLES.YEARLY && (
              <p className="text-sm text-green-600 mt-1">
                Save ${yearlySavings} compared to monthly billing
              </p>
            )}
          </div>

          {/* Benefits */}
          <div>
            <h3 className="font-semibold mb-3">Everything you get:</h3>
            <UpgradeBenefits compact />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? "Redirecting..." : "Upgrade Now"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Maybe Later
            </Button>
          </div>

          {/* Trust Badge */}
          <p className="text-center text-xs text-muted-foreground">
            Cancel anytime • No hidden fees • Instant access
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}