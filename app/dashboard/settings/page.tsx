export const dynamic = 'force-dynamic';
import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getUser, getProfile, getSubscription } from "@/lib/supabase/server";
import { AccountInfoForm } from "@/components/forms/account-info-form";
import { SubscriptionManagement } from "@/components/subscription-management";
import { DangerZone } from "@/components/danger-zone";
import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, subscription] = await Promise.all([
    getProfile(user.id),
    getSubscription(user.id),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="grid gap-8">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Update your personal information and account details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountInfoForm user={user} profile={profile} />
              </CardContent>
            </Card>

            <Separator />

            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Choose your preferred theme</CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeToggle />
              </CardContent>
            </Card>

            <Separator />

            {/* AI Usage */}
            {(subscription?.subscription_plans?.name === "Pro" || 
              subscription?.subscription_plans?.name === "AI Coach") && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      AI Feature Usage
                    </CardTitle>
                    <CardDescription>
                      Monitor your AI feature usage and limits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href="/dashboard/settings/usage">
                      <Button variant="outline" className="w-full">
                        View Detailed Usage
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Separator />
              </>
            )}

            <Separator />

            {/* Subscription Management */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>
                  Manage your subscription plan and billing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriptionManagement
                  userId={user.id}
                  subscription={subscription}
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DangerZone userId={user.id} subscription={subscription} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
