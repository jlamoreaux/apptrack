"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export function CareerAdvice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Career Advice</CardTitle>
        <CardDescription>This feature is coming soon.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center text-muted-foreground py-8 text-lg font-medium">
          🚧 Career Advice will be available soon. Stay tuned!
        </div>
      </CardContent>
    </Card>
  );
}
