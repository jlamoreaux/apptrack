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
    "Lead",
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
    "#8b5cf6", // Lead - lavender
    "#3b82f6", // Applied - blue
    "#06b6d4", // Interview Scheduled - cyan
    "#f59e0b", // Interviewed - amber
    "#10b981", // Offer - emerald
    "#22c55e", // Hired - green
    "#ef4444", // Rejected - red
  ];

  // Build transitions for all applications based on their current status
  // This ensures the chart matches the summary data
  const transitionCounts = new Map<string, number>();

  // Helper to build the full status path for an application
  function buildStatusPath(
    app: Application,
    history: ApplicationHistory[],
    stages: string[]
  ): string[] {
    const appHistory = (history || [])
      .filter((h) => h.application_id === app.id)
      .sort(
        (a, b) =>
          new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
      );

    let path = ["Lead"];
    appHistory.forEach((h) => {
      if (
        h.new_status === "Rejected" &&
        h.old_status &&
        path[path.length - 1] !== h.old_status
      ) {
        const lastIdx = stages.indexOf(path[path.length - 1]);
        const oldIdx = stages.indexOf(h.old_status);
        for (let i = lastIdx + 1; i <= oldIdx; i++) {
          path.push(stages[i]);
        }
      }
      path.push(h.new_status);
    });

    // If the last status in the path is not the current status, fill in missing stages
    if (path[path.length - 1] !== app.status) {
      const lastIndex = stages.indexOf(path[path.length - 1]);
      const currentIndex = stages.indexOf(app.status);
      for (let i = lastIndex + 1; i <= currentIndex; i++) {
        path.push(stages[i]);
      }
    }

    // Fill in all missing intermediate stages between every pair, except if the next status is 'Rejected'
    let fullPath: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const fromIdx = stages.indexOf(path[i]);
      const toIdx = stages.indexOf(path[i + 1]);
      if (fromIdx === -1 || toIdx === -1) continue;
      fullPath.push(stages[fromIdx]);
      if (path[i + 1] !== "Rejected") {
        for (let j = fromIdx + 1; j < toIdx; j++) {
          fullPath.push(stages[j]);
        }
      }
    }
    fullPath.push(path[path.length - 1]);

    return fullPath;
  }

  // For each application, build the full transition path and add all transitions
  applications.forEach((app) => {
    const path = buildStatusPath(app, history, stages);
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const key = `${from}→${to}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
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
  const data: Plotly.Data[] = [
    {
      type: "sankey",
      orientation: "h",
      arrangement: "snap",
      node: {
        pad: 15,
        thickness: 20,
        line: {
          color: "black",
          width: 0.5,
        },
        label: nodeLabels,
        color: nodeColors,
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
