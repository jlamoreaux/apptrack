import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PromoCode, WelcomeOffer, TrafficSourceTrial } from "@/types/promo-codes";

interface OfferBannerProps {
  trafficTrial: TrafficSourceTrial | null;
  promoSuccess: boolean;
  appliedPromo: PromoCode | null;
  welcomeOffer: WelcomeOffer | null;
  showPromoDialog: boolean;
  setShowPromoDialog: (show: boolean) => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  promoLoading: boolean;
  promoError: string | null;
  handleApplyPromo: () => void;
  trafficSource?: string;
}

export function OfferBanner({
  trafficTrial,
  promoSuccess,
  appliedPromo,
  welcomeOffer,
  showPromoDialog,
  setShowPromoDialog,
  promoCode,
  setPromoCode,
  promoLoading,
  promoError,
  handleApplyPromo,
  trafficSource,
}: OfferBannerProps) {
  return (
    <div className="max-w-4xl mx-auto mb-8 px-4 sm:px-0">
      <Card className="border-2 border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-yellow-500/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Gift className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {trafficTrial ? (
                    <>
                      🎁 Special {trafficSource === "reddit" ? "Reddit" : "LinkedIn"} Offer: {trafficTrial.days}-Day Free Trial!
                    </>
                  ) : promoSuccess && appliedPromo ? (
                    <>
                      ✅ Promo Code Applied: {appliedPromo.code}
                    </>
                  ) : welcomeOffer ? (
                    <>
                      🎊 {welcomeOffer.offerMessage || "Welcome Bonus Active!"}
                    </>
                  ) : (
                    "Special offers available!"
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {trafficTrial ? (
                    "Try AI Coach FREE for 7 days • Cancel anytime"
                  ) : promoSuccess ? (
                    "Your discount will be applied at checkout"
                  ) : welcomeOffer ? (
                    "Discount automatically applied • No code needed"
                  ) : (
                    "Check for available promo codes"
                  )}
                </p>
              </div>
            </div>
            <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Tag className="h-4 w-4 mr-2" />
                  {promoSuccess ? "Change Code" : trafficTrial ? "Have a different promo code?" : "Have a promo code?"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Enter Promo Code</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter your promo code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                      disabled={promoLoading}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoCode.trim()}
                    >
                      {promoLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Applying...
                        </>
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                  {promoError && (
                    <Alert className="border-destructive/50 bg-destructive/10">
                      <AlertDescription className="text-destructive text-sm">
                        {promoError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}