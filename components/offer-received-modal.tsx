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
 * The offer/hire moment, pointed at the action that is worth most right then.
 *
 * An offer is the one point at which comp is negotiable, so that state leads to
 * the market comparison. Day one of a new job is the cheapest time to start
 * logging evidence for its first review, so that state leads to setting up the
 * new role.
 *
 * Subscription management stays reachable as a plain link rather than the
 * default path: people who no longer want the product should be able to leave in
 * two clicks without being asked to.
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
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Changing your plan? Cancel any time, no email required.
              </p>
              {/* Own line, not inline in the sentence: a 44px target inside a
                  wrapping paragraph leaves uneven line spacing. */}
              <Link
                href="/dashboard/settings"
                className="inline-flex min-h-[44px] items-center text-xs text-muted-foreground underline hover:text-foreground"
              >
                Manage your subscription
              </Link>
            </div>
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
