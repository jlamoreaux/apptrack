"use client"

import { ResponsiveContainer, Sankey, Tooltip } from "recharts"

interface Application {
  status: string
}

interface ApplicationChartProps {
  applications: Application[]
}

export function ApplicationChart({ applications }: ApplicationChartProps) {
  // Count applications by status
  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  // Create Sankey data structure with brand colors
  const data = {
    nodes: [
      { name: "Applications", fill: "#1e3a5f" }, // Primary blue
      { name: "Applied", fill: "#1e3a5f" }, // Primary blue
      { name: "Interview Scheduled", fill: "#3d8f78" }, // Secondary green
      { name: "Interviewed", fill: "#3d8f78" }, // Secondary green
      { name: "Offer", fill: "#3d8f78" }, // Secondary green
      { name: "Rejected", fill: "#6e7c8c" }, // Accent gray
    ],
    links: [
      { source: 0, target: 1, value: statusCounts["Applied"] || 0 },
      { source: 0, target: 2, value: statusCounts["Interview Scheduled"] || 0 },
      { source: 0, target: 3, value: statusCounts["Interviewed"] || 0 },
      { source: 0, target: 4, value: statusCounts["Offer"] || 0 },
      { source: 0, target: 5, value: statusCounts["Rejected"] || 0 },
    ].filter((link) => link.value > 0),
  }

  if (applications.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No applications to display. Add your first application to see the pipeline visualization.
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey data={data} nodePadding={50} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <Tooltip />
        </Sankey>
      </ResponsiveContainer>
    </div>
  )
}
