/**
 * Main ApplicationCard component
 * 
 * This follows the container/presentation pattern:
 * - ApplicationCardContainer: Handles logic, state, and analytics
 * - ApplicationCardPresentation: Pure UI component
 * - ApplicationErrorBoundary: Error handling wrapper
 */

export { ApplicationCardContainer as ApplicationCard } from './application-card-container';
export { ApplicationCardPresentation } from './application-card-presentation';
export type { Application, PermissionLevel } from '@/types';