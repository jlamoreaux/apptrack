"use client";

import { createContext, useContext } from "react";

interface DashboardFlags {
  isAuditEnabled: boolean;
}

const DashboardFlagsContext = createContext<DashboardFlags>({
  isAuditEnabled: false,
});

export function DashboardFlagsProvider({
  children,
  flags,
}: {
  children: React.ReactNode;
  flags: DashboardFlags;
}) {
  return (
    <DashboardFlagsContext.Provider value={flags}>
      {children}
    </DashboardFlagsContext.Provider>
  );
}

export function useDashboardFlags() {
  return useContext(DashboardFlagsContext);
}
