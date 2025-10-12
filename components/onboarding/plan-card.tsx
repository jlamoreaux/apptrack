import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Brain, Star, ArrowRight } from "lucide-react";
import { PLAN_NAMES } from "@/lib/constants/plans";
import type { PromoCode, WelcomeOffer } from "@/types/promo-codes";

interface PlanCardProps {
  plan: {
    name: string;
    title: string;
    monthlyPrice: number;
    yearlyPrice: number;
    description: string;
    features: string[];
    buttonText: string;
    buttonVariant: "outline" | "default";
    popular?: boolean;
    gradient?: boolean;
  };
  selectedBilling: "monthly" | "yearly";
  activeDiscount: PromoCode | WelcomeOffer | null;
  calculateDiscountedPrice: (price: number, discount: PromoCode | WelcomeOffer | null) => number;
  onSelect: (planName: string) => void;
  isCreatingCheckout: boolean;
  selectedPlan: string | null;
}

export function PlanCard({
  plan,
  selectedBilling,
  activeDiscount,
  calculateDiscountedPrice,
  onSelect,
  isCreatingCheckout,
  selectedPlan,
}: PlanCardProps) {
  const originalPrice = selectedBilling === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const isEligible = plan.name !== PLAN_NAMES.FREE &&
    (!activeDiscount?.applicable_plans || activeDiscount.applicable_plans.includes(plan.name));
  const discountedPrice = isEligible ? calculateDiscountedPrice(originalPrice, activeDiscount) : originalPrice;
  const hasDiscount = isEligible && activeDiscount && discountedPrice < originalPrice;

  return (
    <Card
      className={`relative transition-all duration-200 hover:shadow-xl ${
        plan.popular
          ? "border-2 border-primary shadow-lg md:scale-105 lg:scale-110"
          : "border-border"
      } ${selectedPlan === plan.name ? "ring-2 ring-primary" : ""}`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1">
            <Star className="h-3 w-3 mr-1" />
            MOST POPULAR
          </Badge>
        </div>
      )}

      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">
            {plan.title}
          </h3>
          {plan.name === PLAN_NAMES.PRO && (
            <Crown className="h-5 w-5 text-yellow-500" />
          )}
          {plan.name === PLAN_NAMES.AI_COACH && (
            <Brain className="h-5 w-5 text-purple-500" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {plan.description}
        </p>
        <div className="pt-3">
          {hasDiscount && (
            <span className="text-xl text-muted-foreground line-through mr-2">
              ${originalPrice}
            </span>
          )}
          <span className="text-3xl font-bold text-foreground">
            $
            {plan.name === PLAN_NAMES.FREE
              ? "0"
              : discountedPrice.toFixed(discountedPrice % 1 === 0 ? 0 : 2)}
          </span>
          <span className="text-muted-foreground ml-1">
            {plan.name === PLAN_NAMES.FREE
              ? "/forever"
              : selectedBilling === "monthly"
              ? "/month"
              : "/year"}
          </span>
          {hasDiscount &&
            activeDiscount?.discount_duration === "repeating" &&
            activeDiscount?.discount_duration_months && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                Discounted for {activeDiscount.discount_duration_months} months
              </div>
            )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={() => onSelect(plan.name)}
          variant={plan.buttonVariant}
          className={`w-full font-semibold ${
            plan.gradient
              ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              : ""
          }`}
          size="lg"
          disabled={isCreatingCheckout}
        >
          {isCreatingCheckout && selectedPlan === plan.name ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating checkout...
            </>
          ) : (
            <>
              {plan.buttonText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}