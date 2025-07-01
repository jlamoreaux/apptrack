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
import { Plus, ExternalLink, Building2, Filter } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { SortDropdown } from "@/components/sort-dropdown";
import { StatusFilter } from "@/components/status-filter";
import { useDashboardState } from "@/hooks/use-dashboard-state";
import type { Application } from "@/types";
import type { ApplicationStatus } from "@/lib/constants/application-status";

interface DashboardApplicationsListProps {
  userId: string;
  initialApplications: Application[];
  initialTotal: number;
}

/**
 * Client-side paginated applications list for the dashboard
 * 
 * Features:
 * - Pagination with configurable page sizes
 * - Sorting by multiple fields
 * - Status filtering
 * - URL state management
 * - Loading states
 */
export function DashboardApplicationsList({
  userId,
  initialApplications,
  initialTotal,
}: DashboardApplicationsListProps) {
  const {
    state,
    updatePagination,
    updateSort,
    updateStatusFilter,
    resetFilters,
    hasActiveFilters,
  } = useDashboardState();

  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [totalItems, setTotalItems] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<ApplicationStatus, number>>({});

  // Fetch applications when state changes
  useEffect(() => {
    async function fetchApplications() {
      if (!userId) return;

      setIsLoading(true);
      try {
        // Build query parameters
        const params = new URLSearchParams({
          page: state.page.toString(),
          pageSize: state.pageSize.toString(),
          sortField: state.sortField,
          sortDirection: state.sortDirection,
          includeArchived: "false",
        });

        if (state.statusFilter.length > 0) {
          params.set("statusFilter", state.statusFilter.join(","));
        }

        const response = await fetch(`/api/applications?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch applications");
        }

        const result = await response.json();
        
        setApplications(result.applications);
        setTotalItems(result.totalCount);
        setStatusCounts(result.statusCounts || {});
      } catch (error) {
        console.error('Error fetching applications:', error);
        // Show error toast/notification here
      } finally {
        setIsLoading(false);
      }
    }

    fetchApplications();
  }, [userId, state]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-primary">Applications</CardTitle>
            <CardDescription>
              Track and manage your job applications
            </CardDescription>
          </div>
          <Link href="/dashboard/add">
            <Button className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Application
            </Button>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <SortDropdown
              field={state.sortField}
              direction={state.sortDirection}
              onChange={(config) => updateSort(config.field, config.direction)}
              isLoading={isLoading}
            />
            
            <StatusFilter
              selectedStatuses={state.statusFilter}
              onChange={updateStatusFilter}
              statusCounts={statusCounts}
              isLoading={isLoading}
            />
          </div>
          
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={isLoading}
              className="text-muted-foreground"
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {hasActiveFilters ? "No applications match your filters" : "No applications yet"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {hasActiveFilters 
                ? "Try adjusting your filters to see more applications."
                : "Start tracking your job search by adding your first application. Keep all your opportunities organized in one place."
              }
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={resetFilters}
                disabled={isLoading}
              >
                Clear Filters
              </Button>
            ) : (
              <Link href="/dashboard/add">
                <Button
                  size="lg"
                  className="bg-secondary hover:bg-secondary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Application
                </Button>
              </Link>
            )}
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
                      : 'hover:bg-muted/50 cursor-pointer'
                  }`}
                >
                  <Link 
                    href={`/dashboard/application/${app.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{app.role}</h3>
                        {app.role_link && (
                          <a
                            href={app.role_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
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
                          : "Not specified"}
                      </p>
                    </div>
                  </Link>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={app.status} />
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