"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import type { SortField, SortDirection } from "@/components/sort-dropdown";
import { APPLICATION_STATUS_VALUES, isValidStatus, type ApplicationStatus } from "@/lib/constants/application-status";
import { useDebounce } from "@/lib/utils/debounce";

/**
 * Dashboard filter and pagination state
 */
export interface DashboardState {
  page: number;
  pageSize: number;
  sortField: SortField;
  sortDirection: SortDirection;
  statusFilter: ApplicationStatus[];
  search?: string;
}

/**
 * Default dashboard state values
 */
const DEFAULT_STATE: DashboardState = {
  page: 1,
  pageSize: 25,
  sortField: 'updated_at',
  sortDirection: 'desc',
  statusFilter: [],
  search: undefined,
};

/**
 * Valid page size options
 */
const VALID_PAGE_SIZES = [10, 25, 50, 100];

/**
 * Valid sort fields (must match the component and DAL types)
 * These fields MUST have database indexes for performance
 */
const VALID_SORT_FIELDS: SortField[] = [
  'company_name', 'position_title', 'status', 'application_date', 'created_at', 'updated_at'
];

/**
 * Maximum allowed values for pagination to prevent performance issues
 */
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_NUMBER = 1000;

/**
 * Valid sort directions
 */
const VALID_SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

/**
 * Custom hook for managing dashboard state via URL parameters
 * 
 * Features:
 * - Syncs all dashboard filters with URL parameters
 * - Provides type-safe state management
 * - Handles validation and fallbacks for invalid URL params
 * - Optimized for performance with memoization
 * - Supports browser back/forward navigation
 */
export function useDashboardState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse current state from URL parameters with comprehensive validation
  const currentState = useMemo((): DashboardState => {
    // Validate and parse page number
    const page = (() => {
      const pageParam = searchParams.get('page');
      if (!pageParam) return DEFAULT_STATE.page;
      
      const parsedPage = parseInt(pageParam, 10);
      if (isNaN(parsedPage) || parsedPage < 1 || parsedPage > MAX_PAGE_NUMBER) {
        return DEFAULT_STATE.page;
      }
      return parsedPage;
    })();
    
    // Validate and parse page size
    const pageSize = (() => {
      const sizeParam = searchParams.get('pageSize');
      if (!sizeParam) return DEFAULT_STATE.pageSize;
      
      const parsedSize = parseInt(sizeParam, 10);
      if (isNaN(parsedSize) || !VALID_PAGE_SIZES.includes(parsedSize)) {
        return DEFAULT_STATE.pageSize;
      }
      return parsedSize;
    })();

    // Validate and parse sort field
    const sortField = (() => {
      const fieldParam = searchParams.get('sortField');
      if (!fieldParam) return DEFAULT_STATE.sortField;
      
      const field = fieldParam as SortField;
      return VALID_SORT_FIELDS.includes(field) ? field : DEFAULT_STATE.sortField;
    })();

    // Validate and parse sort direction
    const sortDirection = (() => {
      const directionParam = searchParams.get('sortDirection');
      if (!directionParam) return DEFAULT_STATE.sortDirection;
      
      const direction = directionParam as SortDirection;
      return VALID_SORT_DIRECTIONS.includes(direction) ? direction : DEFAULT_STATE.sortDirection;
    })();

    // Validate and parse status filter
    const statusFilter = (() => {
      const statusParam = searchParams.get('status');
      if (!statusParam) return [];
      
      try {
        // Parse comma-separated values and validate each status
        const rawStatuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
        
        // Filter out invalid statuses and ensure type safety
        const validStatuses = rawStatuses.filter(isValidStatus) as ApplicationStatus[];
        
        // Limit the number of selected statuses to prevent excessive query complexity
        return validStatuses.slice(0, APPLICATION_STATUS_VALUES.length);
      } catch {
        // Return empty array for any parsing errors
        return [];
      }
    })();

    // Validate and parse search term
    const search = (() => {
      const searchParam = searchParams.get('search');
      if (!searchParam) return undefined;
      
      // Basic sanitization - trim whitespace and limit length
      const trimmedSearch = searchParam.trim();
      if (trimmedSearch.length === 0 || trimmedSearch.length > 100) {
        return undefined;
      }
      
      // Basic XSS protection - remove potentially dangerous characters
      const sanitizedSearch = trimmedSearch.replace(/[<>]/g, '');
      return sanitizedSearch || undefined;
    })();

    return {
      page,
      pageSize,
      sortField,
      sortDirection,
      statusFilter,
      search,
    };
  }, [searchParams]);

  // Internal function to update URL parameters
  const updateUrlParams = useCallback((updatedState: DashboardState) => {
    const params = new URLSearchParams();
    
    // Only set non-default values to keep URLs clean
    if (updatedState.page !== DEFAULT_STATE.page) {
      params.set('page', updatedState.page.toString());
    }

    if (updatedState.pageSize !== DEFAULT_STATE.pageSize) {
      params.set('pageSize', updatedState.pageSize.toString());
    }

    if (updatedState.sortField !== DEFAULT_STATE.sortField) {
      params.set('sortField', updatedState.sortField);
    }

    if (updatedState.sortDirection !== DEFAULT_STATE.sortDirection) {
      params.set('sortDirection', updatedState.sortDirection);
    }

    if (updatedState.statusFilter.length > 0) {
      params.set('status', updatedState.statusFilter.join(','));
    }

    if (updatedState.search) {
      params.set('search', updatedState.search);
    }

    // Update URL without page refresh
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl);
  }, [pathname, router]);

  // Debounced version for search updates (to avoid excessive URL changes while typing)
  const debouncedUpdateUrl = useDebounce(updateUrlParams, 300);

  // Internal state to track pending changes
  const pendingStateRef = useRef<DashboardState>(currentState);

  // Update URL with new state
  const updateState = useCallback((newState: Partial<DashboardState>) => {
    // Merge with current state
    const updatedState = { ...pendingStateRef.current, ...newState };

    // Reset to page 1 when filters change (except when explicitly setting page)
    if (newState.statusFilter !== undefined || 
        newState.sortField !== undefined || 
        newState.sortDirection !== undefined ||
        newState.search !== undefined) {
      if (newState.page === undefined) {
        updatedState.page = 1;
      }
    }

    // Update pending state immediately
    pendingStateRef.current = updatedState;

    // Determine if we should debounce or update immediately
    const isSearchUpdate = newState.search !== undefined && Object.keys(newState).length === 1;
    
    if (isSearchUpdate) {
      // Debounce search updates to avoid excessive URL changes while typing
      debouncedUpdateUrl(updatedState);
    } else {
      // Update immediately for pagination, sorting, and filtering changes
      updateUrlParams(updatedState);
    }
  }, [updateUrlParams, debouncedUpdateUrl]);

  // Update pending state ref when URL state changes
  pendingStateRef.current = currentState;

  // Convenience methods for specific state updates
  const updatePagination = useCallback((page: number, pageSize?: number) => {
    updateState({ page, ...(pageSize && { pageSize }) });
  }, [updateState]);

  const updateSort = useCallback((sortField: SortField, sortDirection: SortDirection) => {
    updateState({ sortField, sortDirection });
  }, [updateState]);

  const updateStatusFilter = useCallback((statusFilter: ApplicationStatus[]) => {
    // Validate all status values before updating
    const validStatuses = statusFilter.filter(isValidStatus);
    updateState({ statusFilter: validStatuses });
  }, [updateState]);

  const updateSearch = useCallback((search: string | undefined) => {
    updateState({ search });
  }, [updateState]);

  const resetFilters = useCallback(() => {
    updateState({
      page: DEFAULT_STATE.page,
      statusFilter: DEFAULT_STATE.statusFilter,
      search: DEFAULT_STATE.search,
    });
  }, [updateState]);

  const resetAll = useCallback(() => {
    updateState(DEFAULT_STATE);
  }, [updateState]);

  // Check if any non-default filters are applied
  const hasActiveFilters = useMemo(() => {
    return (
      currentState.statusFilter.length > 0 ||
      currentState.search !== undefined ||
      currentState.sortField !== DEFAULT_STATE.sortField ||
      currentState.sortDirection !== DEFAULT_STATE.sortDirection
    );
  }, [currentState]);

  return {
    // Current state
    state: currentState,
    
    // Update methods
    updateState,
    updatePagination,
    updateSort,
    updateStatusFilter,
    updateSearch,
    
    // Reset methods
    resetFilters,
    resetAll,
    
    // Computed properties
    hasActiveFilters,
    
    // Convenience getters
    isDefaultSort: currentState.sortField === DEFAULT_STATE.sortField && 
                   currentState.sortDirection === DEFAULT_STATE.sortDirection,
  };
}