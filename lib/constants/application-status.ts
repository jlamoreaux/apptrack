/**
 * Shared application status constants
 * 
 * This file defines the canonical status values used across the entire application.
 * All components, DAL methods, and database operations should reference these values.
 */

/**
 * Application status enum with consistent values
 */
export const APPLICATION_STATUS = {
  LEAD: 'Lead',
  APPLIED: 'Applied',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interviewed',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
  WITHDRAWN: 'Withdrawn',
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
 * Array of active status values (excludes archived)
 */
export const ACTIVE_STATUS_VALUES = APPLICATION_STATUS_VALUES.filter(
  status => status !== APPLICATION_STATUS.ARCHIVED
);

/**
 * Status display configuration with colors and descriptions
 */
export const STATUS_CONFIG = {
  [APPLICATION_STATUS.LEAD]: {
    label: 'Lead',
    color: 'bg-purple-100 text-purple-800',
    description: 'Potential opportunity identified',
    order: 1,
  },
  [APPLICATION_STATUS.APPLIED]: {
    label: 'Applied',
    color: 'bg-blue-100 text-blue-800',
    description: 'Application submitted',
    order: 2,
  },
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: {
    label: 'Interview Scheduled',
    color: 'bg-cyan-100 text-cyan-800',
    description: 'Interview scheduled',
    order: 3,
  },
  [APPLICATION_STATUS.INTERVIEWED]: {
    label: 'Interviewed',
    color: 'bg-amber-100 text-amber-800',
    description: 'Interview completed',
    order: 4,
  },
  [APPLICATION_STATUS.OFFER]: {
    label: 'Offer',
    color: 'bg-emerald-100 text-emerald-800',
    description: 'Job offer received',
    order: 5,
  },
  [APPLICATION_STATUS.HIRED]: {
    label: 'Hired',
    color: 'bg-green-100 text-green-800',
    description: 'Offer accepted, hired',
    order: 6,
  },
  [APPLICATION_STATUS.REJECTED]: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    description: 'Application rejected',
    order: 7,
  },
  [APPLICATION_STATUS.WITHDRAWN]: {
    label: 'Withdrawn',
    color: 'bg-gray-100 text-gray-800',
    description: 'Application withdrawn',
    order: 8,
  },
  [APPLICATION_STATUS.ARCHIVED]: {
    label: 'Archived',
    color: 'bg-slate-100 text-slate-800',
    description: 'Archived application',
    order: 9,
  },
} as const;

/**
 * Get status options for UI components (excludes archived by default)
 */
export function getStatusOptions(includeArchived = false) {
  const statuses = includeArchived ? APPLICATION_STATUS_VALUES : ACTIVE_STATUS_VALUES;
  
  return statuses
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