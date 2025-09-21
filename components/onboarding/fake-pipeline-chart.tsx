"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function FakeOnboardingPipelineChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        Loading example chart...
      </div>
    );
  }

  // Define the same stages as the real chart
  const stages = [
    "Applied",
    "Interview Scheduled", 
    "Interviewed",
    "Offer",
    "Hired",
    "Rejected"
  ];

  // Define the same node colors as real chart
  const nodeColors = [
    "#3b82f6", // Applied - blue
    "#06b6d4", // Interview Scheduled - cyan
    "#f59e0b", // Interviewed - amber
    "#10b981", // Offer - emerald
    "#22c55e", // Hired - green
    "#ef4444", // Rejected - red
  ];

  // Create fake data that shows a realistic flow
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
        label: stages,
        color: nodeColors,
      },
      link: {
        // Define connections between stages (indices of stages array)
        source: [0, 0, 1, 1, 2, 2, 3], // From nodes
        target: [1, 5, 2, 5, 3, 5, 4], // To nodes
        value: [8, 4, 6, 2, 4, 2, 3],  // Flow values (number of applications)
        color: [
          "rgba(59, 130, 246, 0.4)",  // Applied to Interview
          "rgba(239, 68, 68, 0.4)",   // Applied to Rejected
          "rgba(6, 182, 212, 0.4)",   // Interview to Interviewed
          "rgba(239, 68, 68, 0.4)",   // Interview to Rejected
          "rgba(245, 158, 11, 0.4)",  // Interviewed to Offer
          "rgba(239, 68, 68, 0.4)",   // Interviewed to Rejected
          "rgba(16, 185, 129, 0.4)",  // Offer to Hired
        ],
        label: [
          "8 applications",
          "4 applications", 
          "6 applications",
          "2 applications",
          "4 applications",
          "2 applications",
          "3 applications"
        ]
      },
    },
  ];

  // Same layout as the real chart
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

  return (
    <div className="relative">
      <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
        <Plot
          data={data}
          layout={layout}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      
      {/* Overlay to indicate it's an example */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-background/95 backdrop-blur-sm rounded-lg px-6 py-3 shadow-lg border border-primary/20">
          <p className="text-sm font-semibold text-primary">
            Example Pipeline View
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Start adding applications to see your own pipeline!
          </p>
        </div>
      </div>
    </div>
  );
}