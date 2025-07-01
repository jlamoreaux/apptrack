"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Archive } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { SortDropdown } from "@/components/sort-dropdown";
import { useDashboardState } from "@/hooks/use-dashboard-state";
import { unarchiveApplicationAction } from "@/lib/actions";
import type { Application } from "@/types";

interface ArchivedApplicationsListProps {
  userId: string;
  initialApplications: Application[];
  initialTotal: number;
}

/**
 * Client-side paginated archived applications list
 * 
 * Features:
 * - Pagination with configurable page sizes
 * - Sorting by multiple fields
 * - URL state management
 * - Loading states
 * - Unarchive functionality
 */
export function ArchivedApplicationsList({
  userId,
  initialApplications,
  initialTotal,
}: ArchivedApplicationsListProps) {
  const {
    state,
    updatePagination,
    updateSort,
  } = useDashboardState();

  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [totalItems, setTotalItems] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch applications when state changes
  useEffect(() => {
    async function fetchArchivedApplications() {
      if (!userId) return;

      setIsLoading(true);
      try {
        // Build query parameters for archived applications
        const params = new URLSearchParams({
          page: state.page.toString(),
          pageSize: state.pageSize.toString(),
          sortField: state.sortField,
          sortDirection: state.sortDirection,
          statusFilter: "Archived", // Only archived applications
          includeArchived: "true",
        });

        const response = await fetch(`/api/applications?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch archived applications");
        }

        const result = await response.json();
        
        setApplications(result.applications);
        setTotalItems(result.totalCount);
      } catch (error) {
        console.error('Error fetching archived applications:', error);
        // Show error toast/notification here
      } finally {
        setIsLoading(false);
      }
    }

    fetchArchivedApplications();
  }, [userId, state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">
          Archived Applications
        </CardTitle>
        <CardDescription>
          Applications you've archived to keep your dashboard clean
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Sort Controls */}
        <div className="flex items-center gap-4 mb-6">
          <SortDropdown
            field={state.sortField}
            direction={state.sortDirection}
            onChange={(config) => updateSort(config.field, config.direction)}
            isLoading={isLoading}
          />
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Archive className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No archived applications
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Applications you archive will appear here. This helps keep
              your main dashboard focused on active opportunities.
            </p>
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Applications Grid */}
            <div className="space-y-4 mb-6">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    isLoading 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{app.role}</h3>
                      {app.role_link && (
                        <a
                          href={app.role_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {app.company}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Applied:{" "}
                      {app.date_applied
                        ? new Date(app.date_applied).toLocaleDateString()
                        : "Not specified"} •
                      Archived:{" "}
                      {new Date(app.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={app.status} />
                    <form
                      action={async (formData: FormData) => {
                        await unarchiveApplicationAction(app.id);
                        // Refresh the list after unarchiving
                        window.location.reload();
                      }}
                    >
                      <Button 
                        variant="outline" 
                        size="sm" 
                        type="submit"
                        disabled={isLoading}
                      >
                        Unarchive
                      </Button>
                    </form>
                    <Link href={`/dashboard/application/${app.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={state.page}
              pageSize={state.pageSize}
              totalItems={totalItems}
              onPageChange={(page) => updatePagination(page)}
              onPageSizeChange={(pageSize) => updatePagination(state.page, pageSize)}
              isLoading={isLoading}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}