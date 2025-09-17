"use client";

import { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface AIToolLayoutProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  isLoading?: boolean;
  error?: string | null;
  result?: ReactNode;
  savedItemsCount?: number;
  onViewSaved?: () => void;
  isDisabled?: boolean;
  disabledMessage?: string | null;
}

export function AIToolLayout({
  title,
  description,
  icon,
  children,
  onSubmit,
  submitLabel,
  isLoading = false,
  error,
  result,
  savedItemsCount,
  onViewSaved,
  isDisabled = false,
  disabledMessage,
}: AIToolLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {icon}
                {title}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            {savedItemsCount !== undefined && savedItemsCount > 0 && onViewSaved && (
              <Button variant="outline" size="sm" onClick={onViewSaved}>
                View Saved ({savedItemsCount})
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Input Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {children}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isDisabled && disabledMessage && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{disabledMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={onSubmit}
            disabled={isLoading || isDisabled}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : isDisabled ? (
              "Limit Reached"
            ) : (
              submitLabel
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && <div className="space-y-6">{result}</div>}
    </div>
  );
}