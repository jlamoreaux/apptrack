"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Available sort fields for applications (must match DAL sortable fields)
 */
export type SortField = 'company_name' | 'position_title' | 'status' | 'application_date' | 'created_at' | 'updated_at';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration
 */
export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/**
 * Props for the SortDropdown component
 */
interface SortDropdownProps {
  /** Current sort field */
  field: SortField;
  /** Current sort direction */
  direction: SortDirection;
  /** Callback when sort changes */
  onChange: (config: SortConfig) => void;
  /** Available sort options */
  sortOptions?: Array<{
    field: SortField;
    label: string;
    description?: string;
  }>;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
}

/**
 * Sort dropdown component for application filtering
 * 
 * Features:
 * - Multiple sort field options
 * - Direction toggle (ascending/descending)
 * - Visual indicators for current sort
 * - Keyboard navigation support
 * - Clear labeling for accessibility
 */
export function SortDropdown({
  field,
  direction,
  onChange,
  sortOptions = [
    { field: 'updated_at', label: 'Last Updated', description: 'Most recently modified' },
    { field: 'created_at', label: 'Date Added', description: 'When application was created' },
    { field: 'application_date', label: 'Date Applied', description: 'When you applied to this job' },
    { field: 'company_name', label: 'Company Name', description: 'Alphabetical by company' },
    { field: 'position_title', label: 'Job Title', description: 'Alphabetical by role' },
    { field: 'status', label: 'Status', description: 'Application status' },
  ],
  isLoading = false,
}: SortDropdownProps) {
  // Get current sort option details
  const currentOption = sortOptions.find(option => option.field === field);
  const currentLabel = currentOption?.label || 'Sort';

  // Handle sort field change (toggles direction if same field, otherwise uses desc)
  const handleSortChange = (newField: SortField) => {
    const newDirection: SortDirection = 
      newField === field 
        ? direction === 'asc' ? 'desc' : 'asc'
        : 'desc';
    
    onChange({ field: newField, direction: newDirection });
  };

  // Get sort direction icon
  const getSortIcon = (sortField: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    
    return direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  // Get display text for current sort
  const getSortDisplayText = () => {
    const directionText = direction === 'asc' ? 'A-Z' : 'Z-A';
    const timeDirectionText = direction === 'asc' ? 'Oldest' : 'Newest';
    
    switch (field) {
      case 'company_name':
      case 'position_title':
      case 'status':
        return `${currentLabel} (${directionText})`;
      case 'application_date':
      case 'created_at':
      case 'updated_at':
        return `${currentLabel} (${timeDirectionText})`;
      default:
        return currentLabel;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={isLoading}
          aria-label={`Sort by ${getSortDisplayText()}`}
        >
          <ArrowUpDown className="h-4 w-4" />
          <span className="hidden sm:inline">Sort:</span>
          <span className="font-medium">{getSortDisplayText()}</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-56"
        aria-label="Sort options"
      >
        {sortOptions.map((option, index) => {
          const isActive = option.field === field;
          
          return (
            <div key={option.field}>
              <DropdownMenuItem
                onClick={() => handleSortChange(option.field)}
                className="flex items-center justify-between cursor-pointer"
                aria-label={`Sort by ${option.label} ${
                  isActive 
                    ? direction === 'asc' ? 'ascending' : 'descending'
                    : ''
                }`}
              >
                <div className="flex flex-col">
                  <span className={`font-medium ${isActive ? 'text-primary' : ''}`}>
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </div>
                {getSortIcon(option.field)}
              </DropdownMenuItem>
              
              {/* Add separator after every 3 items for better grouping */}
              {index === 2 && <DropdownMenuSeparator />}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}