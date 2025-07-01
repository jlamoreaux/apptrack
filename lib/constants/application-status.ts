/**
 * Shared application status constants
 * 
 * This file defines the canonical status values used across the entire application.
 * All components, DAL methods, and database operations should reference these values.
 * 
 * These values MUST match the database constraint in schemas/applications.sql
 */

import { getStatusColors } from './accessible-colors';

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
 * Type guard to check if a value is a valid ApplicationStatus
 */
export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && 
         Object.values(APPLICATION_STATUS).includes(value as ApplicationStatus);
}

/**
 * Assert that a value is a valid ApplicationStatus (throws if not)
 */
export function assertApplicationStatus(value: unknown): asserts value is ApplicationStatus {
  if (!isApplicationStatus(value)) {
    throw new Error(`Invalid application status: ${String(value)}. Must be one of: ${APPLICATION_STATUS_VALUES.join(', ')}`);
  }
}

/**
 * Array of all status values (useful for validation)
 */
export const APPLICATION_STATUS_VALUES = Object.values(APPLICATION_STATUS) as ApplicationStatus[];

/**
 * Status display configuration with WCAG-compliant colors and descriptions
 * Uses the accessible color system for consistent styling
 */
export const STATUS_CONFIG = {
  [APPLICATION_STATUS.APPLIED]: (() => {
    const { bg, text, border } = getStatusColors('Applied');
    return {
      label: 'Applied',
      description: 'Application submitted',
      order: 1,
      bg,
      text,
      border,
    };
  })(),
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: (() => {
    const { bg, text, border } = getStatusColors('Interview Scheduled');
    return {
      label: 'Interview Scheduled',
      description: 'Interview scheduled',
      order: 2,
      bg,
      text,
      border,
    };
  })(),
  [APPLICATION_STATUS.INTERVIEWED]: (() => {
    const { bg, text, border } = getStatusColors('Interviewed');
    return {
      label: 'Interviewed',
      description: 'Interview completed',
      order: 3,
      bg,
      text,
      border,
    };
  })(),
  [APPLICATION_STATUS.OFFER]: (() => {
    const { bg, text, border } = getStatusColors('Offer');
    return {
      label: 'Offer',
      description: 'Job offer received',
      order: 4,
      bg,
      text,
      border,
    };
  })(),
  [APPLICATION_STATUS.HIRED]: (() => {
    const { bg, text, border } = getStatusColors('Hired');
    return {
      label: 'Hired',
      description: 'Offer accepted, hired',
      order: 5,
      bg,
      text,
      border,
    };
  })(),
  [APPLICATION_STATUS.REJECTED]: (() => {
    const { bg, text, border } = getStatusColors('Rejected');
    return {
      label: 'Rejected',
      description: 'Application rejected',
      order: 6,
      bg,
      text,
      border,
    };
  })(),
} as const satisfies Record<ApplicationStatus, {
  label: string;
  description: string;
  order: number;
  bg: string;
  text: string;
  border: string;
}>;

/**
 * Get status options for UI components with type safety
 */
export function getStatusOptions() {
  return APPLICATION_STATUS_VALUES
    .map(status => ({
      value: status,
      label: STATUS_CONFIG[status].label,
      description: STATUS_CONFIG[status].description,
      order: STATUS_CONFIG[status].order,
      colors: {
        bg: STATUS_CONFIG[status].bg,
        text: STATUS_CONFIG[status].text,
        border: STATUS_CONFIG[status].border,
      }
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