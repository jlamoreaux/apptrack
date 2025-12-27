"use client";

import { X, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getStatusOptions, type ApplicationStatus } from "@/lib/constants/application-status";

/**
 * Props for the StatusFilter component
 */
interface StatusFilterProps {
  /** Currently selected status filters */
  selectedStatuses: ApplicationStatus[];
  /** Callback when status selection changes */
  onChange: (statuses: ApplicationStatus[]) => void;
  /** Total count of applications per status (optional) */
  statusCounts?: Record<ApplicationStatus, number>;
  /** Whether to show status counts in the filter */
  showCounts?: boolean;
  /** Whether to include archived status in options */
  includeArchived?: boolean;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
}

/**
 * Multi-select status filter component for application filtering
 * 
 * Features:
 * - Multi-select dropdown with checkboxes
 * - Visual status badges with color coding
 * - Optional status counts display
 * - Clear all functionality
 * - Keyboard navigation support
 * - Accessibility compliant
 */
export function StatusFilter({
  selectedStatuses,
  onChange,
  statusCounts = {},
  showCounts = true,
  includeArchived = false,
  isLoading = false,
}: StatusFilterProps) {
  // Get status options from shared constants
  const statusOptions = getStatusOptions(includeArchived);

  // Handle individual status toggle
  const toggleStatus = (status: ApplicationStatus) => {
    const newSelection = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    
    onChange(newSelection);
  };

  // Handle clear all
  const clearAll = () => {
    onChange([]);
  };

  // Handle select all
  const selectAll = () => {
    onChange(statusOptions.map(option => option.value));
  };

  // Get display text for filter button
  const getFilterDisplayText = () => {
    if (selectedStatuses.length === 0) {
      return "All Statuses";
    }
    
    if (selectedStatuses.length === 1) {
      const status = statusOptions.find(opt => opt.value === selectedStatuses[0]);
      return status?.label || selectedStatuses[0];
    }
    
    if (selectedStatuses.length === statusOptions.length) {
      return "All Statuses";
    }
    
    return `${selectedStatuses.length} Selected`;
  };

  // Check if all statuses are selected
  const allSelected = selectedStatuses.length === statusOptions.length;
  const noneSelected = selectedStatuses.length === 0;

  return (
    <div className="flex items-center gap-2">
      {/* Main filter dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            disabled={isLoading}
            aria-label={`Filter by status: ${getFilterDisplayText()}`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Status:</span>
            <span className="font-medium">{getFilterDisplayText()}</span>
            {selectedStatuses.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {selectedStatuses.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          align="end" 
          className="w-64"
          aria-label="Status filter options"
        >
          {/* Select/Clear all controls */}
          <div className="flex items-center justify-between px-2 py-1.5 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? clearAll : selectAll}
              disabled={isLoading}
              className="h-6 px-2 text-xs"
            >
              {allSelected ? "Clear All" : "Select All"}
            </Button>
            
            {selectedStatuses.length > 0 && (
              <span className="text-muted-foreground">
                {selectedStatuses.length} of {statusOptions.length}
              </span>
            )}
          </div>
          
          <DropdownMenuSeparator />
          
          {/* Status options */}
          {statusOptions.map((option) => {
            const isSelected = selectedStatuses.includes(option.value);
            const count = statusCounts[option.value] || 0;
            
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => toggleStatus(option.value)}
                className="flex items-center justify-between cursor-pointer py-2"
                aria-label={`${isSelected ? 'Unselect' : 'Select'} ${option.label} status${showCounts ? ` (${count} applications)` : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox indicator */}
                  <div className={`w-4 h-4 border border-input rounded-sm flex items-center justify-center ${isSelected ? 'bg-primary text-primary-foreground' : ''}`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  
                  {/* Status badge */}
                  <Badge 
                    variant="outline" 
                    className={`${option.color} border-transparent`}
                  >
                    {option.label}
                  </Badge>
                </div>
                
                {/* Count display */}
                {showCounts && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {count}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Selected status badges (for mobile/compact view) */}
      {selectedStatuses.length > 0 && selectedStatuses.length <= 3 && (
        <div className="hidden lg:flex items-center gap-1 flex-wrap">
          {selectedStatuses.map((status) => {
            const option = statusOptions.find(opt => opt.value === status);
            if (!option) return null;
            
            return (
              <Badge
                key={status}
                variant="outline"
                className={`${option.color} border-transparent text-xs cursor-pointer hover:opacity-80`}
                onClick={() => toggleStatus(status)}
              >
                {option.label}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
      
      {/* Clear all button (when multiple selected) */}
      {selectedStatuses.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Clear all status filters"
        >
          Clear All
        </Button>
      )}
    </div>
  );
}