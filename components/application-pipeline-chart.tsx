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
import type { Application, ApplicationHistory } from "@/types";
import {
  buildStatusPath,
  countTransitions,
  buildSankeyData,
} from "@/lib/pipeline-utils";

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

  // Define the pipeline stages in order (must match database schema)
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
    "#06b6d4", // Interview Scheduled - cyan
    "#f59e0b", // Interviewed - amber
    "#10b981", // Offer - emerald
    "#22c55e", // Hired - green
    "#ef4444", // Rejected - red
  ];

  // Build all status paths for applications
  const allPaths = applications.map((app) =>
    buildStatusPath(app, history, stages)
  );

  // Map transition key to list of application display strings
  const transitionApplications: Record<string, string[]> = {};
  applications.forEach((app, idx) => {
    const path = allPaths[idx];
    // @ts-ignore: role and company may not exist on Application type, but are present in your data
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

  // Build Sankey data
  const { sources, targets, values, linkColors } = buildSankeyData(
    transitionCounts,
    nodeLabels,
    nodeColors
  );

  // Build link labels for hover
  const linkLabels: string[] = [];
  Array.from(transitionCounts.keys()).forEach((key) => {
    const apps = transitionApplications[key] || [];
    linkLabels.push(apps.length ? apps.join("<br>") : "");
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
        label: linkLabels,
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
      </CardContent>
    </Card>
  );
}
