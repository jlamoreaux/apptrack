"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Building2, TrendingUp } from "lucide-react";
import Link from "next/link";

interface DashboardStatsProps {
  userId: string;
}

export function DashboardStats({ userId }: DashboardStatsProps) {
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "1",
          includeArchived: "false",
        });
        const response = await fetch(`/api/applications?${params.toString()}`);
        if (!response.ok) return;
        const result = await response.json();
        setStatusCounts(result.statusCounts || {});
        setTotal(result.totalCount || 0);
      } catch {
        // Stats will remain at 0
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [userId]);

  const stats = {
    total,
    applied: statusCounts["Applied"] || 0,
    interviews:
      (statusCounts["Interview Scheduled"] || 0) +
      (statusCounts["Interviewed"] || 0),
    offers: statusCounts["Offer"] || 0,
    hired: statusCounts["Hired"] || 0,
  };

  if (isLoading) {
    return (
      <section
        aria-labelledby="stats-heading"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6"
      >
        <h2 id="stats-heading" className="sr-only">
          Application Statistics
        </h2>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-8" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  // Empty state: show welcoming onboarding card instead of five "0" stat cards
  if (stats.total === 0) {
    return (
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Application Statistics</h2>
        <Card className="border-primary/20 bg-badge-indigo">
          <CardContent className="py-8 text-center">
            <Building2 className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold font-display mb-2">
              Welcome to AppTrack
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Add your first application to start tracking your job search progress.
            </p>
            <Link
              href="/dashboard/add"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground font-medium transition-colors min-h-[44px]"
            >
              Add Your First Application
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="stats-heading"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6"
    >
      <h2 id="stats-heading" className="sr-only">
        Application Statistics
      </h2>
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Total
          </CardTitle>
          <Building2 className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card className="border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Applied
          </CardTitle>
          <Calendar className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">{stats.applied}</div>
        </CardContent>
      </Card>
      <Card className="border-secondary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Interviews
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">
            {stats.interviews}
          </div>
        </CardContent>
      </Card>
      <Card className="border-secondary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Offers
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">{stats.offers}</div>
        </CardContent>
      </Card>
      <Card className="border-secondary/20 col-span-full sm:col-span-1 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Hired
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">{stats.hired}</div>
        </CardContent>
      </Card>
    </section>
  );
}
