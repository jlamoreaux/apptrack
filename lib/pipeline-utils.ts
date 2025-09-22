import type { Application, ApplicationHistory } from "./types";

export function buildStatusPath(
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

  // If we have history, use the existing logic
  if (appHistory.length > 0) {
    let path = ["Applied"];

    appHistory.forEach((h) => {
      // For rejected status, use the old_status as the source
      if (h.new_status === "Rejected") {
        if (h.old_status && h.old_status !== path[path.length - 1]) {
          // If we need to get to the old_status first, fill in intermediate stages
          const lastIdx = stages.indexOf(path[path.length - 1]);
          const oldIdx = stages.indexOf(h.old_status);
          if (lastIdx !== -1 && oldIdx !== -1 && oldIdx > lastIdx) {
            for (let i = lastIdx + 1; i <= oldIdx; i++) {
              path.push(stages[i]);
            }
          }
        }
        path.push(h.new_status);
      } else {
        // For non-rejected status, fill in intermediate stages if needed
        const lastIdx = stages.indexOf(path[path.length - 1]);
        const newIdx = stages.indexOf(h.new_status);
        if (lastIdx !== -1 && newIdx !== -1 && newIdx > lastIdx) {
          for (let i = lastIdx + 1; i <= newIdx; i++) {
            path.push(stages[i]);
          }
        } else {
          path.push(h.new_status);
        }
      }
    });

    // If the current status is not the last in the path, handle it appropriately
    if (path[path.length - 1] !== app.status) {
      if (app.status === "Rejected") {
        path.push(app.status);
      } else {
        // For other statuses, fill in intermediate stages
        const lastIndex = stages.indexOf(path[path.length - 1]);
        const currentIndex = stages.indexOf(app.status);
        if (lastIndex !== -1 && currentIndex !== -1 && currentIndex > lastIndex) {
          for (let i = lastIndex + 1; i <= currentIndex; i++) {
            path.push(stages[i]);
          }
        } else {
          path.push(app.status);
        }
      }
    }

    // Remove duplicates while preserving order
    return path.filter(
      (status, index, array) => array.indexOf(status) === index
    );
  }

  // No history - create a synthetic path based on current status
  // All applications start at "Applied"
  const path = ["Applied"];
  
  // Build path to current status based on logical progression
  const currentIndex = stages.indexOf(app.status);
  
  if (app.status === "Rejected") {
    // Rejections can happen at any stage, estimate based on common patterns
    // For demo purposes, assume different rejection points
    const randomStage = Math.floor(Math.random() * 3);
    if (randomStage === 0) {
      // Rejected after application
      path.push("Rejected");
    } else if (randomStage === 1) {
      // Rejected after interview scheduled
      path.push("Interview Scheduled");
      path.push("Rejected");
    } else {
      // Rejected after interview
      path.push("Interview Scheduled");
      path.push("Interviewed");
      path.push("Rejected");
    }
  } else if (currentIndex !== -1 && currentIndex > 0) {
    // Add all intermediate stages up to current status
    for (let i = 1; i <= currentIndex; i++) {
      if (stages[i] !== "Rejected") {
        path.push(stages[i]);
      }
    }
  } else if (app.status !== "Applied") {
    // Just add the current status if it's not in our stages array
    path.push(app.status);
  }

  return path;
}

export function countTransitions(paths: string[][]): Map<string, number> {
  const transitionCounts = new Map<string, number>();
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}→${path[i + 1]}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    }
  }
  return transitionCounts;
}

export function buildSankeyData(
  transitionCounts: Map<string, number>,
  nodeLabels: string[],
  nodeColors: string[]
) {
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
        linkColors.push("rgba(239, 68, 68, 0.4)");
      } else if (to === "Hired") {
        linkColors.push("rgba(34, 197, 94, 0.4)");
      } else {
        linkColors.push("rgba(59, 130, 246, 0.4)");
      }
    }
  });

  return { sources, targets, values, linkColors };
}
