"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import dynamic from "next/dynamic";
import type { Application, ApplicationHistory } from "@/types";
import {
  buildStatusPath,
  countTransitions,
} from "@/lib/pipeline-utils";
import { useOnboarding } from '@/lib/onboarding/context';
import { FakeOnboardingPipelineChart } from './onboarding/fake-pipeline-chart';
import { useDashboardFlags } from "@/components/providers/dashboard-flags-provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ApplicationPipelineChartProps {
  applications: Application[];
  history?: ApplicationHistory[];
}

export function ApplicationPipelineChart({
  applications,
  history = [],
}: ApplicationPipelineChartProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  // Safely use the onboarding context - it might not be available
  let currentStep = null;
  let currentFlow = null;
  try {
    const onboarding = useOnboarding();
    currentStep = onboarding?.currentStep;
    currentFlow = onboarding?.currentFlow;
  } catch (e) {
    // Context not available, that's fine
  }
  
  // Check if we're in any onboarding flow (show fake chart during onboarding)
  const isInOnboarding = currentFlow !== null;
  const isOnboardingPipelineStep = currentStep?.id === 'view-pipeline';
  const { isAuditEnabled } = useDashboardFlags();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card data-onboarding="pipeline-chart">
        <CardHeader>
          <CardTitle>Application Pipeline</CardTitle>
          <CardDescription>Visualize your job search progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            Loading chart...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show fake chart during onboarding or when no applications
  if (applications.length === 0) {
    return (
      <Card data-onboarding="pipeline-chart">
        <CardHeader>
          <CardTitle>Application Pipeline</CardTitle>
          <CardDescription>
            Track your job search progress through each stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInOnboarding ? (
            <FakeOnboardingPipelineChart />
          ) : (
            <div className={`${isAuditEnabled ? "h-[200px]" : "h-[400px]"} flex flex-col items-center justify-center text-muted-foreground gap-3`}>
              <p>No applications to display yet.</p>
              {isAuditEnabled && (
                <Button variant="outline" className="min-h-11 px-4" asChild>
                  <Link href="/dashboard/add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Application
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // When audit enabled and very few applications, show a hint
  const showSparseHint = isAuditEnabled && applications.length < 4;

  // Define the pipeline stages in order (must match database schema)
  // "Awaiting Response" is a terminal node for apps still at Applied
  const stages = [
    "Applied",
    "Interview Scheduled",
    "Interviewed",
    "Offer",
    "Hired",
    "Rejected",
    "Awaiting Response",
  ];

  // Define node colors
  const nodeColors = [
    "#3b82f6", // Applied - blue
    "#06b6d4", // Interview Scheduled - cyan
    "#f59e0b", // Interviewed - amber
    "#10b981", // Offer - emerald
    "#22c55e", // Hired - green
    "#ef4444", // Rejected - red
    "#6b7280", // Awaiting Response - gray
  ];

  // Build all status paths for applications
  const allPaths = applications.map((app) =>
    buildStatusPath(app, history, stages)
  );

  // Count how many apps pass through each node
  const nodeCounts: Record<string, number> = {};
  allPaths.forEach((path) => {
    const seen = new Set<string>();
    path.forEach((stage) => {
      if (!seen.has(stage)) {
        nodeCounts[stage] = (nodeCounts[stage] || 0) + 1;
        seen.add(stage);
      }
    });
  });

  // Create node labels with counts
  const nodeLabels = stages.map(
    (stage) => `${stage} (${nodeCounts[stage] || 0})`
  );

  // Map transition key to list of application display strings
  const transitionApplications: Record<string, string[]> = {};
  applications.forEach((app, idx) => {
    const path = allPaths[idx];
    const display = `${(app as any).role || app.id} -- ${
      (app as any).company || ""
    }`;
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const key = `${from}→${to}`;
      if (!transitionApplications[key]) transitionApplications[key] = [];
      transitionApplications[key].push(display);
    }
  });

  // Count transitions
  const transitionCounts = countTransitions(allPaths);

  // Build Sankey data (use stages for index lookup, not nodeLabels with counts)
  const sources: number[] = [];
  const targets: number[] = [];
  const values: number[] = [];
  const linkColors: string[] = [];

  const linkLabels: string[] = [];

  transitionCounts.forEach((count, key) => {
    const [from, to] = key.split("→");
    const sourceIndex = stages.indexOf(from);
    const targetIndex = stages.indexOf(to);
    if (sourceIndex !== -1 && targetIndex !== -1) {
      sources.push(sourceIndex);
      targets.push(targetIndex);
      values.push(count);
      const apps = transitionApplications[key] || [];
      linkLabels.push(apps.length ? apps.join("<br>") : "");
      if (to === "Rejected") {
        linkColors.push("rgba(239, 68, 68, 0.4)");
      } else if (to === "Hired") {
        linkColors.push("rgba(34, 197, 94, 0.4)");
      } else if (to === "Awaiting Response") {
        linkColors.push("rgba(107, 114, 128, 0.3)");
      } else {
        linkColors.push("rgba(59, 130, 246, 0.4)");
      }
    }
  });

  // Create the Plotly data for the Sankey diagram
  const data: Plotly.Data[] = [
    {
      type: "sankey",
      orientation: "h",
      arrangement: "snap",
      node: {
        pad: 25,
        thickness: 24,
        line: {
          color: "rgba(0,0,0,0)",
          width: 0,
        },
        label: nodeLabels,
        color: nodeColors,
        hovertemplate: "%{label}<extra></extra>",
        // Custom positions: [Applied, Interview Scheduled, Interviewed, Offer, Hired, Rejected, Awaiting Response]
        x: [0.01, 0.35, 0.55, 0.75, 0.99, 0.99, 0.22],
        y: [0.55, 0.55, 0.55, 0.25, 0.40, 0.99, 0.01],
      },
      link: {
        source: sources,
        target: targets,
        value: values,
        color: linkColors,
        label: linkLabels,
      },
    } as Plotly.Data,
  ];

  // Create the layout for the Sankey diagram
  const layout = {
    title: {
      text: "",
    },
    font: {
      size: 13,
      color: resolvedTheme === "dark" ? "#9ca3af" : "#374151",
    },
    autosize: true,
    margin: {
      l: 8,
      r: 8,
      b: 8,
      t: 8,
      pad: 8,
    },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  };

  return (
    <Card data-onboarding="pipeline-chart">
      <CardHeader>
        <CardTitle>Application Pipeline Flow</CardTitle>
        <CardDescription>
          Track how applications progress through each stage of your job search
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          <Plot
            data={data}
            layout={layout}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        {showSparseHint && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Add more applications to see a richer pipeline visualization.
          </p>
        )}
      </CardContent>
    </Card>
  );
}