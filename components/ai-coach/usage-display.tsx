"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { UsageStats } from "@/lib/services/rate-limit.service";

interface UsageDisplayProps {
  userId: string;
  feature?: string;
  compact?: boolean;
}

const FEATURE_NAMES: Record<string, string> = {
  resume_analysis: "Resume Analysis",
  interview_prep: "Interview Preparation",
  cover_letter: "Cover Letter Generator",
  career_advice: "Career Advice Chat",
  job_fit_analysis: "Job Fit Analysis",
};

export function UsageDisplay({ userId, feature, compact = false }: UsageDisplayProps) {
  const [usageStats, setUsageStats] = useState<UsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsageStats();
    // Refresh every minute
    const interval = setInterval(fetchUsageStats, 60000);
    return () => clearInterval(interval);
  }, [userId, feature]);

  const fetchUsageStats = async () => {
    try {
      const endpoint = feature 
        ? `/api/ai-coach/usage?feature=${feature}`
        : '/api/ai-coach/usage';
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch usage stats');
      
      const data = await response.json();
      setUsageStats(Array.isArray(data) ? data : [data]);
      setError(null);
    } catch (err) {
      console.error('Error fetching usage stats:', err);
      setError('Unable to load usage information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (compact && usageStats.length === 1) {
    const stat = usageStats[0];
    const hourlyPercentage = (stat.hourlyUsed / stat.hourlyLimit) * 100;
    const dailyPercentage = (stat.dailyUsed / stat.dailyLimit) * 100;
    const isNearLimit = hourlyPercentage >= 80 || dailyPercentage >= 80;
    const isAtLimit = hourlyPercentage >= 100 || dailyPercentage >= 100;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Usage Limits</span>
          {isAtLimit && <Badge variant="destructive">Limit Reached</Badge>}
          {!isAtLimit && isNearLimit && <Badge variant="secondary">Near Limit</Badge>}
        </div>
        
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Hourly: {stat.hourlyUsed}/{stat.hourlyLimit}</span>
              <span>{stat.hourlyRemaining} remaining</span>
            </div>
            <Progress value={hourlyPercentage} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Daily: {stat.dailyUsed}/{stat.dailyLimit}</span>
              <span>{stat.dailyRemaining} remaining</span>
            </div>
            <Progress value={dailyPercentage} className="h-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          AI Feature Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {usageStats.map(stat => {
          const hourlyPercentage = (stat.hourlyUsed / stat.hourlyLimit) * 100;
          const dailyPercentage = (stat.dailyUsed / stat.dailyLimit) * 100;
          const isNearLimit = hourlyPercentage >= 80 || dailyPercentage >= 80;
          const isAtLimit = hourlyPercentage >= 100 || dailyPercentage >= 100;

          return (
            <div key={stat.feature} className="space-y-3 pb-4 border-b last:border-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{FEATURE_NAMES[stat.feature]}</h4>
                {isAtLimit && <Badge variant="destructive" className="text-xs">Limit Reached</Badge>}
                {!isAtLimit && isNearLimit && <Badge variant="secondary" className="text-xs">Near Limit</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Hourly
                    </span>
                    <span className="font-medium">
                      {stat.hourlyUsed}/{stat.hourlyLimit}
                    </span>
                  </div>
                  <Progress 
                    value={hourlyPercentage} 
                    className={`h-2 ${isAtLimit ? 'bg-red-100' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {stat.hourlyRemaining} remaining
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Daily</span>
                    <span className="font-medium">
                      {stat.dailyUsed}/{stat.dailyLimit}
                    </span>
                  </div>
                  <Progress 
                    value={dailyPercentage} 
                    className={`h-2 ${isAtLimit ? 'bg-red-100' : ''}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {stat.dailyRemaining} remaining
                  </p>
                </div>
              </div>

              {isAtLimit && (
                <Alert className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You've reached your limit. Resets at {
                      hourlyPercentage >= 100 
                        ? stat.resetAt.hourly.toLocaleTimeString()
                        : stat.resetAt.daily.toLocaleTimeString()
                    }
                  </AlertDescription>
                </Alert>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}