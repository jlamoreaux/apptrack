"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Brain,
  FileText,
  MessageSquare,
  Lightbulb,
  Target,
  Users,
  Clock,
  RefreshCw,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

interface AggregatedUsage {
  feature: string;
  hourlyTotal: number;
  dailyTotal: number;
  allTimeTotal: number;
  uniqueUsersHourly: number;
  uniqueUsersDaily: number;
  uniqueUsersAllTime: number;
  successRate: number;
  lastUsed: string | null;
}

interface SystemTotals {
  hourlyTotal: number;
  dailyTotal: number;
  allTimeTotal: number;
  uniqueUsersHourly: number;
  uniqueUsersDaily: number;
  uniqueUsersAllTime: number;
}

interface UsageData {
  features: AggregatedUsage[];
  systemTotals: SystemTotals;
  resetTimes: {
    hourly: string;
    daily: string;
  };
  currentTime: string;
}

const featureIcons: Record<string, React.ReactNode> = {
  resume_analysis: <Brain className="h-5 w-5" />,
  interview_prep: <MessageSquare className="h-5 w-5" />,
  cover_letter: <FileText className="h-5 w-5" />,
  career_advice: <Lightbulb className="h-5 w-5" />,
  job_fit_analysis: <Target className="h-5 w-5" />,
};

const featureNames: Record<string, string> = {
  resume_analysis: "Resume Analysis",
  interview_prep: "Interview Prep",
  cover_letter: "Cover Letter",
  career_advice: "Career Advice",
  job_fit_analysis: "Job Fit Analysis",
};

export default function AIUsagePage() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsageData = async () => {
    try {
      setError(null);
      const response = await fetch("/api/admin/ai-usage");

      if (!response.ok) {
        throw new Error("Failed to fetch AI usage data");
      }

      const data = await response.json();
      setUsageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
    const interval = setInterval(fetchUsageData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsageData();
  };

  const formatTimeUntilReset = (resetTime: string) => {
    const reset = new Date(resetTime);
    const now = new Date();
    const diffMs = reset.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);

    if (diffMins > 60) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
    return `${diffMins}m`;
  };

  const formatLastUsed = (lastUsed: string | null) => {
    if (!lastUsed) return "Never";

    const date = new Date(lastUsed);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">AI Usage Statistics</h1>
          </div>
          <p className="text-muted-foreground ml-12">
            Real-time from Redis, with database totals
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["All-Time Usage", "Today", "This Hour"].map(label => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage Breakdown</CardTitle>
              <CardDescription>Usage statistics for each AI-powered feature</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(featureNames).map(([key, name]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {featureIcons[key]}
                        <span className="font-medium">{name}</span>
                      </div>
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {["All Time", "Today", "This Hour"].map(col => (
                        <div key={col} className="space-y-1">
                          <p className="text-xs text-muted-foreground">{col}</p>
                          <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-14 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Reset Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {["Hourly Reset", "Daily Reset"].map(label => (
                  <div key={label} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : usageData && (
        <>
          {/* System Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  All-Time Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{usageData.systemTotals.allTimeTotal}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {usageData.systemTotals.uniqueUsersAllTime} unique users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-bold">{usageData.systemTotals.dailyTotal}</p>
                  <div className="text-xs text-muted-foreground">
                    Resets in {formatTimeUntilReset(usageData.resetTimes.daily)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {usageData.systemTotals.uniqueUsersDaily} unique users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Hour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-bold">{usageData.systemTotals.hourlyTotal}</p>
                  <div className="text-xs text-muted-foreground">
                    Resets in {formatTimeUntilReset(usageData.resetTimes.hourly)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {usageData.systemTotals.uniqueUsersHourly} unique users
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage Breakdown</CardTitle>
              <CardDescription>
                Usage statistics for each AI-powered feature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {usageData.features.map((feature) => (
                  <div key={feature.feature} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {featureIcons[feature.feature]}
                        <span className="font-medium">
                          {featureNames[feature.feature] || feature.feature}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Last used: {formatLastUsed(feature.lastUsed)}</span>
                        {feature.dailyTotal > 0 && (
                          <span>{feature.successRate}% success</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">All Time</p>
                        <p className="text-lg font-semibold">{feature.allTimeTotal}</p>
                        <p className="text-xs text-muted-foreground">{feature.uniqueUsersAllTime} users</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Today</p>
                        <p className="text-lg font-semibold">{feature.dailyTotal}</p>
                        <p className="text-xs text-muted-foreground">{feature.uniqueUsersDaily} users</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">This Hour</p>
                        <p className="text-lg font-semibold">{feature.hourlyTotal}</p>
                        <p className="text-xs text-muted-foreground">{feature.uniqueUsersHourly} users</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reset Times */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Reset Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Hourly Reset</p>
                  <p className="text-lg">
                    {new Date(usageData.resetTimes.hourly).toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resets in {formatTimeUntilReset(usageData.resetTimes.hourly)}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Daily Reset</p>
                  <p className="text-lg">
                    {new Date(usageData.resetTimes.daily).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resets in {formatTimeUntilReset(usageData.resetTimes.daily)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
