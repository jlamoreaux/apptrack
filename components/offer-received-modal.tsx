"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, DollarSign, Trophy } from "lucide-react";

interface OfferReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  roleName: string;
  isSubscribed: boolean;
  status?: "Offer" | "Hired";
}

/**
 * The offer/hire moment.
 *
 * This used to congratulate the user and then walk them into cancelling their
 * subscription — reasonable when the product ended at "job tracked", actively
 * wrong now that landing the role is the start of the case for the next one. So
 * each state hands over the action that's actually worth money at that moment:
 * an offer is the one time comp is negotiable, and day one of a new job is the
 * cheapest time to start logging evidence for its first review.
 *
 * Cancelling stays one honest link away rather than the default path — the
 * promise was never to nag people into cancelling, it was to not charge them for
 * something they don't want.
 */
export function OfferReceivedModal({
  isOpen,
  onClose,
  companyName,
  roleName,
  isSubscribed,
  status = "Offer",
}: OfferReceivedModalProps) {
  const isHired = status === "Hired";

  const Icon = isHired ? Trophy : DollarSign;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl">
            {isHired ? "You got it" : "Offer in hand"}
          </DialogTitle>
          <DialogDescription>
            {isHired ? (
              <>
                Hired as <span className="font-semibold">{roleName}</span> at{" "}
                <span className="font-semibold">{companyName}</span>.
              </>
            ) : (
              <>
                An offer for <span className="font-semibold">{roleName}</span> at{" "}
                <span className="font-semibold">{companyName}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2 rounded-lg border p-4">
            <h4 className="text-sm font-semibold">
              {isHired ? "Start the next case on day one" : "Do the comp work first"}
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isHired
                ? "Your first review at a new job is the easiest one to walk into prepared, and the hardest one to reconstruct from memory eleven months later. Set your new role and review date, then log as you go."
                : "This is the one moment the number is negotiable. Check the offer against the market for this role and level before you answer."}
            </p>
            <Button asChild className="min-h-[44px]">
              <Link href={isHired ? "/dashboard?setup=role" : "/dashboard/comp"}>
                {isHired ? "Set up your new role" : "Check it against the market"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isSubscribed && (
            <p className="text-xs text-muted-foreground">
              Changing your plan?{" "}
              <Link href="/dashboard/settings" className="underline hover:text-foreground">
                Manage your subscription
              </Link>
              . Cancel any time, no email required.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
            Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
