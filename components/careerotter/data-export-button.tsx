"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

/**
 * One-click export (M2c privacy). Hits the export endpoint and triggers a file
 * download of everything CareerOtter holds for the user.
 */
export function DataExportButton() {
  return (
    <Button variant="outline" asChild>
      <a href="/api/careerotter/export" download="careerotter-export.json">
        <Download className="mr-2 h-4 w-4" />
        Export my data (JSON)
      </a>
    </Button>
  );
}
