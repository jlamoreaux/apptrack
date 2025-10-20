"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ArrowLeft, 
  Sparkles,
  Clock,
  Zap 
} from "lucide-react";
import { APP_ROUTES } from "@/lib/constants/routes";
import { UI_CONSTANTS, COMING_SOON_FEATURES, NOTIFICATIONS } from "@/lib/constants/ui";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  expectedDate?: string;
  features?: string[];
  backLink?: {
    href: string;
    label: string;
  };
}

/**
 * Reusable "Coming Soon" placeholder component for unimplemented pages
 * Provides clear communication about upcoming features
 */
export function ComingSoonPage({
  title,
  description,
  icon: Icon = Sparkles,
  expectedDate,
  features = [],
  backLink = { 
    href: APP_ROUTES.DASHBOARD.ROOT, 
    label: NOTIFICATIONS.MESSAGES.BACK_TO_DASHBOARD 
  }
}: ComingSoonPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className={`container mx-auto ${UI_CONSTANTS.SPACING.CONTAINER_PADDING}`}>
        <div className={`${UI_CONSTANTS.SIZES.CONTAINER.MAX_CONTENT} mx-auto text-center ${UI_CONSTANTS.SPACING.SECTION_SPACING}`}>
          {/* Main Content */}
          <div className="space-y-4">
            <div className={`${UI_CONSTANTS.SIZES.ICON.AVATAR} mx-auto rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center`}>
              <Icon className={`${UI_CONSTANTS.SIZES.ICON.XXL} text-white`} />
            </div>
            
            <div className="space-y-2">
              <h1 className={`${UI_CONSTANTS.SIZES.TEXT.HERO} font-bold text-foreground`}>
                {title}
              </h1>
              <p className={`${UI_CONSTANTS.SIZES.TEXT.XL} text-muted-foreground max-w-lg mx-auto`}>
                {description}
              </p>
            </div>

            <Badge 
              variant="secondary" 
              className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-2"
            >
              <Clock className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`} />
              {NOTIFICATIONS.MESSAGES.COMING_SOON}
            </Badge>
          </div>

          {/* Expected Date */}
          {expectedDate && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Calendar className={UI_CONSTANTS.SIZES.ICON.MD} />
                  <span className="font-medium">Expected: {expectedDate}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Planned Features */}
          {features.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className={`${UI_CONSTANTS.SIZES.ICON.MD} text-yellow-500`} />
                  What's Coming
                </CardTitle>
                <CardDescription>
                  Features we're planning to include
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-left">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <span className={`${UI_CONSTANTS.SIZES.TEXT.SM} text-muted-foreground`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild>
              <Link href={backLink.href}>
                <ArrowLeft className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`} />
                {backLink.label}
              </Link>
            </Button>
            
            <Button variant="outline" asChild>
              <Link href={APP_ROUTES.DASHBOARD.SETTINGS}>
                {NOTIFICATIONS.MESSAGES.FEATURE_READY}
              </Link>
            </Button>
          </div>

          {/* Progress Indicator */}
          <div className="pt-8 border-t">
            <p className={`${UI_CONSTANTS.SIZES.TEXT.SM} text-muted-foreground`}>
              {NOTIFICATIONS.MESSAGES.WORKING_ON_IT}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Applications page is now implemented - this component is no longer needed

/**
 * Pre-configured coming soon component for Analytics page  
 */
export function AnalyticsComingSoon() {
  return (
    <ComingSoonPage
      title="Analytics Dashboard"
      description="Deep insights into your job search performance with interactive charts and actionable recommendations"
      icon={Calendar}
      expectedDate={COMING_SOON_FEATURES.ANALYTICS.EXPECTED_DATE}
      features={COMING_SOON_FEATURES.ANALYTICS.FEATURES}
    />
  );
}
