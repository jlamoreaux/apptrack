/**
 * Shared application status constants
 * 
 * This file defines the canonical status values used across the entire application.
 * All components, DAL methods, and database operations should reference these values.
 * 
 * These values MUST match the database constraint in schemas/applications.sql
 */

/**
 * Application status enum with values matching database constraint
 * These must match the status check constraint in the database schema
 */
export const APPLICATION_STATUS = {
  APPLIED: 'Applied',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interviewed',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
} as const;

/**
 * Type for application status values
 */
export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];

/**
 * Array of all status values (useful for validation)
 */
export const APPLICATION_STATUS_VALUES = Object.values(APPLICATION_STATUS) as ApplicationStatus[];

/**
 * Status display configuration with colors and descriptions
 */
export const STATUS_CONFIG = {
  [APPLICATION_STATUS.APPLIED]: {
    label: 'Applied',
    color: 'bg-blue-100 text-blue-800',
    description: 'Application submitted',
    order: 1,
  },
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: {
    label: 'Interview Scheduled',
    color: 'bg-cyan-100 text-cyan-800',
    description: 'Interview scheduled',
    order: 2,
  },
  [APPLICATION_STATUS.INTERVIEWED]: {
    label: 'Interviewed',
    color: 'bg-amber-100 text-amber-800',
    description: 'Interview completed',
    order: 3,
  },
  [APPLICATION_STATUS.OFFER]: {
    label: 'Offer',
    color: 'bg-emerald-100 text-emerald-800',
    description: 'Job offer received',
    order: 4,
  },
  [APPLICATION_STATUS.HIRED]: {
    label: 'Hired',
    color: 'bg-green-100 text-green-800',
    description: 'Offer accepted, hired',
    order: 5,
  },
  [APPLICATION_STATUS.REJECTED]: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    description: 'Application rejected',
    order: 6,
  },
} as const;

/**
 * Get status options for UI components
 */
export function getStatusOptions() {
  return APPLICATION_STATUS_VALUES
    .map(status => ({
      value: status,
      label: STATUS_CONFIG[status].label,
      color: STATUS_CONFIG[status].color,
      description: STATUS_CONFIG[status].description,
      order: STATUS_CONFIG[status].order,
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Validate if a status value is valid
 */
export function isValidStatus(status: string): status is ApplicationStatus {
  return APPLICATION_STATUS_VALUES.includes(status as ApplicationStatus);
}

/**
 * Get status configuration
 */
export function getStatusConfig(status: ApplicationStatus) {
  return STATUS_CONFIG[status];
}