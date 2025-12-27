import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TrafficSourceTrial, PromoCode } from "@/types/promo-codes";
import { PLAN_NAMES } from "@/lib/constants/plans";
import { clientLogger } from "@/lib/utils/client-logger";
import { LogCategory } from "@/lib/services/logger.types";

interface UseTrialManagementProps {
  user: any;
  onTrialDetected?: (trial: TrafficSourceTrial) => void;
}

export function useTrialManagement({ user, onTrialDetected }: UseTrialManagementProps) {
  const [trafficTrial, setTrafficTrial] = useState<TrafficSourceTrial | null>(null);
  const [shouldAutoSelectPlan, setShouldAutoSelectPlan] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user has a traffic source trial
    if (user?.user_metadata?.traffic_source_trial) {
      const trial = user.user_metadata.traffic_source_trial;
      
      clientLogger.info("Traffic source trial detected in onboarding", {
        category: LogCategory.BUSINESS,
        action: 'onboarding_traffic_source_trial',
        metadata: {
          source: user.user_metadata.traffic_source,
          trial: trial
        }
      });
      
      // Store trial info for checkout
      sessionStorage.setItem("traffic_trial", JSON.stringify(trial));
      setTrafficTrial(trial);
      
      if (onTrialDetected) {
        onTrialDetected(trial);
      }
      
      // Check if we should auto-select a plan
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auto_select') === 'ai_coach') {
        setShouldAutoSelectPlan(true);
      }
    }
  }, [user, onTrialDetected]);

  const getTrialDays = (planName: string): number => {
    if (trafficTrial && planName === PLAN_NAMES.AI_COACH && trafficTrial.type === "ai_coach_trial") {
      return trafficTrial.days;
    }
    return 0;
  };

  const getTrialMessage = (planName: string, promoCode?: PromoCode | null): string | null => {
    // Traffic source trial
    if (trafficTrial && planName === PLAN_NAMES.AI_COACH) {
      return `Includes ${trafficTrial.days}-day free trial`;
    }
    
    // Promo code trial
    if (promoCode?.trial_days && promoCode.plan_name === planName) {
      return `Includes ${promoCode.trial_days}-day free trial`;
    }
    
    return null;
  };

  const hasActiveTrial = (): boolean => {
    return !!trafficTrial;
  };

  return {
    trafficTrial,
    shouldAutoSelectPlan,
    getTrialDays,
    getTrialMessage,
    hasActiveTrial,
  };
}