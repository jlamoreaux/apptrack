import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSubscription, getUsage } from "@/lib/supabase/server";
import { AlertCircle, CheckCircle, Infinity } from "lucide-react";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function SubscriptionUsageBannerServer({
  userId,
}: {
  userId: string;
}) {
  // Add timeouts to prevent hanging
  const subscriptionPromise = getSubscription(userId);
  const usagePromise = getUsage(userId);

  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve(null), 3000)
  );

  // Race the data fetches against timeouts
  const subscription = await Promise.race([
    subscriptionPromise,
    timeoutPromise,
  ]);
  const usage = await Promise.race([usagePromise, timeoutPromise]);

  // Default values if data is not available
  const maxApplications =
    subscription?.subscription_plans?.max_applications || 5;
  const applicationsCount = usage?.applications_count || 0;
  const isPro = subscription?.subscription_plans?.name === "Pro";

  // Calculate usage percentage
  const usagePercentage =
    maxApplications === -1
      ? 0
      : Math.min((applicationsCount / maxApplications) * 100, 100);
  const remaining =
    maxApplications === -1
      ? -1
      : Math.max(0, maxApplications - applicationsCount);

  return (
    <div className={`p-4 rounded-lg ${isPro ? "bg-secondary/10" : "bg-muted"}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <CheckCircle className="h-5 w-5 text-secondary" />
                <h3 className="font-medium">Pro Plan</h3>
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Free Plan</h3>
                {applicationsCount >= maxApplications && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Limit reached
                  </span>
                )}
              </>
            )}
          </div>

          <div className="space-y-1">
            {isPro ? (
              <div className="flex items-center gap-2">
                <Infinity className="h-4 w-4 text-secondary" />
                <p className="text-sm">Unlimited job applications</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>
                    {applicationsCount} of {maxApplications} applications used
                  </span>
                  <span>{remaining} remaining</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
              </>
            )}
          </div>
        </div>

        {!isPro && (
          <Link href="/dashboard/upgrade">
            <Button className="bg-secondary hover:bg-secondary/90 whitespace-nowrap">
              Upgrade to Pro
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
