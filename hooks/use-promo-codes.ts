import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PromoCode, WelcomeOffer } from "@/types/promo-codes";
import { toast } from "@/hooks/use-toast";

export function usePromoCodes() {
  const router = useRouter();
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [showPromoDialog, setShowPromoDialog] = useState(false);

  const handleApplyPromo = async (codeToApply?: string) => {
    const code = codeToApply || promoCode.trim();
    
    if (!code) {
      setPromoError("Please enter a promo code");
      return;
    }

    setPromoLoading(true);
    setPromoError(null);

    try {
      // Check if it's a valid code
      const checkResponse = await fetch("/api/promo-codes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase() }),
      });

      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        setPromoError(checkData.error || "Invalid promo code");
        return;
      }

      // Store the applied promo for later use
      setAppliedPromo(checkData.promoCode);
      setPromoSuccess(true);
      setShowPromoDialog(false);
      
      toast({
        title: "Promo code applied!",
        description: `${checkData.promoCode.code} has been applied successfully.`,
      });
      
      // If we auto-applied, update the input
      if (codeToApply) {
        setPromoCode(codeToApply);
      }

      // If it's a premium free code, apply it immediately without payment
      if (checkData.promoCode.code_type === "premium_free") {
        const response = await fetch("/api/promo/activate-trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promoCode: code }),
        });

        const data = await response.json();

        if (!response.ok) {
          setPromoError(data.error || "Failed to apply promo code");
          setPromoSuccess(false);
        } else {
          // Mark onboarding complete and redirect to dashboard
          await fetch("/api/auth/complete-onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          
          toast({
            title: "Welcome to AppTrack Premium!",
            description: "Your premium features have been activated.",
          });
          
          router.push("/dashboard?promo=success");
        }
      }
    } catch (err) {
      setPromoError("An error occurred. Please try again.");
      setPromoSuccess(false);
    } finally {
      setPromoLoading(false);
    }
  };

  const resetPromoState = () => {
    setPromoCode("");
    setPromoError(null);
    setPromoSuccess(false);
    setAppliedPromo(null);
  };

  return {
    promoCode,
    setPromoCode,
    promoLoading,
    promoError,
    promoSuccess,
    appliedPromo,
    showPromoDialog,
    setShowPromoDialog,
    handleApplyPromo,
    resetPromoState,
  };
}