"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PartyPopper, X } from "lucide-react";
import Link from "next/link";

const DISMISS_KEY = "hired-banner-dismissed";

export function HiredSubscriptionBanner({
  hasHiredApplication,
  isPaidSubscriber,
}: {
  hasHiredApplication: boolean;
  isPaidSubscriber: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (!hasHiredApplication || !isPaidSubscriber || dismissed) {
    return null;
  }

  return (
    <Card className="p-4 rounded-lg bg-muted">
      <CardContent>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <PartyPopper className="h-5 w-5 text-primary shrink-0" />
            <span className="font-medium">
              Congratulations on getting hired! You can cancel your subscription
              if you no longer need it.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/settings">
              <Button variant="secondary" className="whitespace-nowrap">
                Manage Subscription
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss banner"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, "true");
                setDismissed(true);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
