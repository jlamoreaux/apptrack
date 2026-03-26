"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface DashboardFlags {
  isAuditEnabled: boolean;
}

const DashboardFlagsContext = createContext<DashboardFlags>({
  isAuditEnabled: false,
});

/**
 * Provides feature flag values to dashboard child components.
 * Server-side flag is the initial value; client-side localStorage
 * overrides are reconciled on mount for local dev testing.
 */
export function DashboardFlagsProvider({
  children,
  flags,
}: {
  children: React.ReactNode;
  flags: DashboardFlags;
}) {
  const [resolved, setResolved] = useState(flags);

  useEffect(() => {
    try {
      const local = localStorage.getItem("ff:dashboard-ux-audit-v1");
      if (local === "true") {
        setResolved({ isAuditEnabled: true });
      } else if (local === "false") {
        setResolved({ isAuditEnabled: false });
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <DashboardFlagsContext.Provider value={resolved}>
      {children}
    </DashboardFlagsContext.Provider>
  );
}

export function useDashboardFlags() {
  return useContext(DashboardFlagsContext);
}
