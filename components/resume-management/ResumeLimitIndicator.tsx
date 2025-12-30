"use client";

import { useState, useEffect } from "react";
import { FileText, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface LimitInfo {
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
}

interface ResumeLimitIndicatorProps {
  userId: string;
  variant?: "card" | "compact";
  showUpgrade?: boolean;
}

export function ResumeLimitIndicator({
  userId,
  variant = "compact",
  showUpgrade = true,
}: ResumeLimitIndicatorProps) {
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchLimitInfo() {
      try {
        const response = await fetch("/api/resume/check-limit");
        if (response.ok) {
          const data = await response.json();
          setLimitInfo(data);
        }
      } catch (err) {
        console.error("Failed to fetch resume limit:", err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchLimitInfo();
    }
  }, [userId]);

  if (loading || !limitInfo) {
    return null;
  }

  const percentage = (limitInfo.current / limitInfo.limit) * 100;
  const isFree = limitInfo.plan === "Free";
  const isNearLimit = percentage >= 80;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {limitInfo.current} / {limitInfo.limit} resumes
          </span>
          <Badge variant={isFree ? "secondary" : "default"} className="text-xs">
            {limitInfo.plan}
          </Badge>
        </div>
        {isFree && showUpgrade && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/pricing")}
            className="gap-2"
          >
            <Sparkles className="h-3 w-3" />
            Upgrade for 100 resumes
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Storage
          </span>
          <Badge variant={isFree ? "secondary" : "default"}>
            {limitInfo.plan} Plan
          </Badge>
        </CardTitle>
        <CardDescription>
          {limitInfo.current} of {limitInfo.limit} resumes used
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span className="font-medium">
              {percentage.toFixed(0)}% full
            </span>
          </div>
          <Progress
            value={percentage}
            className={isNearLimit ? "bg-yellow-100" : ""}
          />
        </div>

        {isFree && showUpgrade ? (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">Upgrade to store up to 100 resumes</p>
                <p className="text-sm text-muted-foreground">
                  Manage multiple versions for different job types and track
                  which resume you used for each application.
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/pricing")}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to AI Coach
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {limitInfo.limit - limitInfo.current > 0 ? (
              <>You can upload {limitInfo.limit - limitInfo.current} more resumes.</>
            ) : (
              <>You've reached your resume limit. Delete a resume to upload a new one.</>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
