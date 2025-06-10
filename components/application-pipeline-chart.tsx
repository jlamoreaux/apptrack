"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Application {
  id: string;
  status: string;
}

interface ApplicationHistory {
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
}

interface ApplicationPipelineChartProps {
  applications: Application[];
  history?: ApplicationHistory[];
}

export function ApplicationPipelineChart({
  applications,
  history = [],
}: ApplicationPipelineChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card>
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

  if (applications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Pipeline</CardTitle>
          <CardDescription>
            Track your job search progress through each stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No applications to display. Add your first application to see the
            pipeline visualization.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Define the pipeline stages in order
  const stages = [
    "Applied",
    "Interview Scheduled",
    "Interviewed",
    "Offer",
    "Hired",
    "Rejected",
  ];

  // Create nodes for the Sankey diagram
  const nodeLabels = stages;

  // Define node colors
  const nodeColors = [
    "#3b82f6", // Applied - blue
    "#8b5cf6", // Interview Scheduled - purple
    "#06b6d4", // Interviewed - cyan
    "#10b981", // Offer - emerald
    "#22c55e", // Hired - green
    "#ef4444", // Rejected - red
  ];

  // Build transitions for all applications based on their current status
  // This ensures the chart matches the summary data
  const transitionCounts = new Map<string, number>();

  // Define the correct order of stages
  const stageOrder = [
    "Applied",
    "Interview Scheduled",
    "Interviewed",
    "Offer",
    "Hired",
    "Rejected",
  ];

  // For each application, reconstruct the path from Applied to its current status
  applications.forEach((app) => {
    if (app.status === "Rejected") {
      // Find the last non-rejected status from history
      const appHistory = (history || [])
        .filter((h) => h.application_id === app.id)
        .sort(
          (a, b) =>
            new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
        );
      let lastStatus = "Applied";
      if (appHistory.length > 0) {
        // Traverse history to find the last non-rejected status
        for (let i = 0; i < appHistory.length; i++) {
          if (appHistory[i].new_status !== "Rejected") {
            lastStatus = appHistory[i].new_status;
          } else {
            break;
          }
        }
      }
      const key = `${lastStatus}→Rejected`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    } else {
      const currentIndex = stageOrder.indexOf(app.status);
      if (currentIndex > 0) {
        // Build the path from Applied up to the current status
        for (let i = 0; i < currentIndex; i++) {
          const from = stageOrder[i];
          const to = stageOrder[i + 1];
          const key = `${from}→${to}`;
          transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
        }
      }
    }
  });

  // Now build the Sankey source/target/value arrays
  const sources: number[] = [];
  const targets: number[] = [];
  const values: number[] = [];
  const linkColors: string[] = [];

  transitionCounts.forEach((count, key) => {
    const [from, to] = key.split("→");
    const sourceIndex = nodeLabels.indexOf(from);
    const targetIndex = nodeLabels.indexOf(to);
    if (sourceIndex !== -1 && targetIndex !== -1) {
      sources.push(sourceIndex);
      targets.push(targetIndex);
      values.push(count);
      // Color links based on target
      if (to === "Rejected") {
        linkColors.push("rgba(239, 68, 68, 0.4)"); // Red for rejections
      } else if (to === "Hired") {
        linkColors.push("rgba(34, 197, 94, 0.4)"); // Green for hired
      } else {
        linkColors.push("rgba(59, 130, 246, 0.4)"); // Blue for progression
      }
    }
  });

  // Create the Plotly data for the Sankey diagram
  const data = [
    {
      type: "sankey" as const,
      orientation: "h" as const,
      arrangement: "snap" as const,
      node: {
        pad: 15,
        thickness: 20,
        line: {
          color: "black",
          width: 0.5,
        },
        label: nodeLabels,
        color: nodeColors,
        align: "justify" as const,
      },
      link: {
        source: sources,
        target: targets,
        value: values,
        color: linkColors,
      },
    },
  ];

  // Create the layout for the Sankey diagram
  const layout = {
    title: {
      text: "",
    },
    font: {
      size: 12,
    },
    autosize: true,
    margin: {
      l: 0,
      r: 0,
      b: 0,
      t: 0,
      pad: 4,
    },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  };

  // Calculate current status counts for summary
  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Pipeline Flow</CardTitle>
        <CardDescription>
          Track how applications progress through each stage of your job search
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <Plot
            data={data}
            layout={layout}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Stage Reach Summary */}
        {/* <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Pipeline Reach</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {stages.map((stage) => (
              <div key={stage}>
                <div className="text-muted-foreground">{stage}</div>
                <div className="text-lg font-bold">
                  {statusCounts[stage] || 0}
                </div>
              </div>
            ))}
          </div>
        </div> */}

        {/* Current Status Summary */}
        {/* <div className="mt-4 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Current Status Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status}>
                <div className="text-muted-foreground">{status}</div>
                <div className="text-lg font-bold">{count}</div>
              </div>
            ))}
          </div>
        </div> */}

        {/* <div className="mt-4 text-xs text-muted-foreground">
          💡 This chart shows the actual flow of applications through your
          pipeline stages based on status change history
        </div> */}
      </CardContent>
    </Card>
  );
}
