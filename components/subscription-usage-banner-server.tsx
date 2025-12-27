import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSubscription, getUsage } from "@/lib/supabase/server";
import { AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";

const USAGE_WARNING_THRESHOLD = 70; // Show earlier to give users time to upgrade

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
    subscription?.subscription_plans?.max_applications || 100;
  const applicationsCount = usage?.applications_count || 0;
  const isProOrHigher = isOnProOrHigher(
    subscription?.subscription_plans?.name || "Free"
  );

  // Calculate usage percentage
  const usagePercentage =
    maxApplications === -1
      ? 0
      : Math.min((applicationsCount / maxApplications) * 100, 100);
  const remaining =
    maxApplications === -1
      ? -1
      : Math.max(0, maxApplications - applicationsCount);

  // Only show if not Pro/AI Coach and usage is at or above threshold
  if (
    isProOrHigher ||
    maxApplications === -1 ||
    usagePercentage < USAGE_WARNING_THRESHOLD
  ) {
    return null;
  }

  return (
    <Card className={`p-4 rounded-lg bg-muted`}>
      <CardContent>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="font-medium">
                {applicationsCount >= maxApplications ? "You've reached your free limit" : "You're approaching your free limit"}
              </span>
              {applicationsCount >= maxApplications && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Limit reached
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  {applicationsCount} of {maxApplications} applications used
                </span>
                <span>{remaining} remaining</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
          </div>
          <Link href="/dashboard/upgrade">
            <Button className="bg-secondary hover:bg-secondary/90 whitespace-nowrap">
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to AI Coach
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
