"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import dynamic from "next/dynamic"

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

interface Application {
  id: string
  status: string
}

interface ApplicationHistory {
  application_id: string
  old_status: string | null
  new_status: string
  changed_at: string
}

interface ApplicationPipelineChartProps {
  applications: Application[]
  history?: ApplicationHistory[]
}

export function ApplicationPipelineChart({ applications, history = [] }: ApplicationPipelineChartProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Pipeline</CardTitle>
          <CardDescription>Visualize your job search progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
        </CardContent>
      </Card>
    )
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application Pipeline</CardTitle>
          <CardDescription>Track your job search progress through each stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No applications to display. Add your first application to see the pipeline visualization.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Analyze application history to build the actual flow
  const applicationPaths = new Map<string, string[]>()

  // Initialize each application with "Applied" as the starting status
  applications.forEach((app) => {
    applicationPaths.set(app.id, ["Applied"])
  })

  // Build the path for each application based on history
  history
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    .forEach((change) => {
      const path = applicationPaths.get(change.application_id) || ["Applied"]
      // Only add if it's a new status (avoid duplicates)
      if (path[path.length - 1] !== change.new_status) {
        path.push(change.new_status)
      }
      applicationPaths.set(change.application_id, path)
    })

  console.log("Application paths:", Object.fromEntries(applicationPaths))

  // Define the pipeline stages in order
  const stages = ["Applied", "Interview Scheduled", "Interviewed", "Offer", "Hired", "Rejected"]

  // Count how many applications reached each stage
  const stageReachCounts = new Map<string, number>()
  stages.forEach((stage) => stageReachCounts.set(stage, 0))

  // Count transitions between stages
  const transitions = new Map<string, number>()

  applicationPaths.forEach((path) => {
    // Count stages reached
    const uniqueStages = [...new Set(path)]
    uniqueStages.forEach((stage) => {
      if (stageReachCounts.has(stage)) {
        stageReachCounts.set(stage, (stageReachCounts.get(stage) || 0) + 1)
      }
    })

    // Count transitions
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      const transitionKey = `${from} → ${to}`
      transitions.set(transitionKey, (transitions.get(transitionKey) || 0) + 1)
    }
  })

  console.log("Stage reach counts:", Object.fromEntries(stageReachCounts))
  console.log("Transitions:", Object.fromEntries(transitions))

  // Create nodes for the Sankey diagram
  const nodeLabels = stages
  const nodeColors = [
    "#3b82f6", // Applied - blue
    "#8b5cf6", // Interview Scheduled - purple
    "#06b6d4", // Interviewed - cyan
    "#10b981", // Offer - emerald
    "#22c55e", // Hired - green
    "#ef4444", // Rejected - red
  ]

  // Create links based on actual transitions
  const sources: number[] = []
  const targets: number[] = []
  const values: number[] = []
  const linkColors: string[] = []

  // Add transitions as links
  transitions.forEach((count, transitionKey) => {
    const [fromStage, toStage] = transitionKey.split(" → ")
    const sourceIndex = stages.indexOf(fromStage)
    const targetIndex = stages.indexOf(toStage)

    if (sourceIndex !== -1 && targetIndex !== -1 && count > 0) {
      sources.push(sourceIndex)
      targets.push(targetIndex)
      values.push(count)

      // Color links based on target
      if (toStage === "Rejected") {
        linkColors.push("rgba(239, 68, 68, 0.4)") // Red for rejections
      } else if (toStage === "Hired") {
        linkColors.push("rgba(34, 197, 94, 0.4)") // Green for hired
      } else {
        linkColors.push("rgba(59, 130, 246, 0.4)") // Blue for progression
      }
    }
  })

  console.log("Sankey links:", {
    sources,
    targets,
    values,
    linkLabels: sources.map((s, i) => `${nodeLabels[s]} → ${nodeLabels[targets[i]]}: ${values[i]}`),
  })

  // Create the Plotly data for the Sankey diagram
  const data = [
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
  ]

  // Create the layout for the Sankey diagram
  const layout = {
    title: "",
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
  }

  // Calculate current status counts for summary
  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application Pipeline Flow</CardTitle>
        <CardDescription>Track how applications progress through each stage of your job search</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Debug info */}
        <div className="mb-4 p-3 bg-gray-100 rounded text-xs space-y-1">
          <div>
            <strong>Total applications:</strong> {applications.length}
          </div>
          <div>
            <strong>Applications that reached each stage:</strong>
          </div>
          {stages.map((stage) => (
            <div key={stage} className="ml-2">
              {stage}: {stageReachCounts.get(stage) || 0}
            </div>
          ))}
          <div>
            <strong>Transitions found:</strong>
          </div>
          {Array.from(transitions.entries()).map(([transition, count]) => (
            <div key={transition} className="ml-2">
              {transition}: {count}
            </div>
          ))}
          <div>
            <strong>Current status distribution:</strong> {JSON.stringify(statusCounts)}
          </div>
        </div>

        <div className="h-[400px] w-full">
          <Plot
            data={data}
            layout={layout}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Stage Reach Summary */}
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Pipeline Reach</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {stages.map((stage) => (
              <div key={stage}>
                <div className="text-muted-foreground">{stage}</div>
                <div className="text-lg font-bold">{stageReachCounts.get(stage) || 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Status Summary */}
        <div className="mt-4 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Current Status Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status}>
                <div className="text-muted-foreground">{status}</div>
                <div className="text-lg font-bold">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          💡 This chart shows the actual flow of applications through your pipeline stages based on status change
          history
        </div>
      </CardContent>
    </Card>
  )
}
