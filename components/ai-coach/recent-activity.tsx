"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Brain, MessageSquare, FileText, Target, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  feature_name: string;
  created_at: string;
  success: boolean;
  metadata?: any;
}

interface RecentActivityProps {
  userId: string;
}

const featureIcons: Record<string, any> = {
  resume_analysis: Brain,
  interview_prep: MessageSquare,
  cover_letter: FileText,
  career_advice: Target,
  job_fit_analysis: BarChart3,
};

const featureNames: Record<string, string> = {
  resume_analysis: "Resume Analysis",
  interview_prep: "Interview Preparation",
  cover_letter: "Cover Letter Generator",
  career_advice: "Career Advice",
  job_fit_analysis: "Job Fit Analysis",
};

const featureColors: Record<string, string> = {
  resume_analysis: "bg-purple-100 text-purple-700",
  interview_prep: "bg-blue-100 text-blue-700",
  cover_letter: "bg-green-100 text-green-700",
  career_advice: "bg-orange-100 text-orange-700",
  job_fit_analysis: "bg-indigo-100 text-indigo-700",
};

export function RecentActivity({ userId }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, [userId]);

  const fetchRecentActivity = async () => {
    try {
      const response = await fetch("/api/ai-coach/recent-activity?limit=5", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const { activities } = await response.json();
        setActivities(activities || []);
      }
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your recent AI Coach interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your recent AI Coach interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity</p>
            <p className="text-sm mt-1">Start using AI Coach features to see your history here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>Your recent AI Coach interactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = featureIcons[activity.feature_name] || Target;
            const name = featureNames[activity.feature_name] || activity.feature_name;
            const colorClass = featureColors[activity.feature_name] || "bg-gray-100 text-gray-700";

            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass.split(' ')[0]}`}>
                  <Icon className={`h-5 w-5 ${colorClass.split(' ')[1]}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{name}</p>
                    {activity.metadata?.overall_score && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.metadata.overall_score}% match
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}