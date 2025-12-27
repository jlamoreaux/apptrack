import { DALError } from "@/dal/base";

// Base service interface
export interface BaseService<T, CreateInput, UpdateInput> {
  // CRUD operations
  create(data: CreateInput): Promise<T>;
  findById(id: string): Promise<T | null>;
  findByUserId(userId: string): Promise<T[]>;
  update(id: string, data: UpdateInput): Promise<T | null>;
  delete(id: string): Promise<boolean>;

  // Utility methods
  exists(id: string): Promise<boolean>;
  count(userId?: string): Promise<number>;
}

// Service error types
export class ServiceError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = "ServiceError";
  }
}

export class ValidationServiceError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationServiceError";
  }
}

export class PermissionServiceError extends ServiceError {
  constructor(message: string) {
    super(message, "PERMISSION_DENIED");
    this.name = "PermissionServiceError";
  }
}

export class NotFoundServiceError extends ServiceError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, "NOT_FOUND");
    this.name = "NotFoundServiceError";
  }
}

// Service result types
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

export interface PaginatedServiceResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Helper function to wrap DAL errors in service errors
export const wrapDALError = (error: unknown, context: string): ServiceError => {
  if (error instanceof DALError) {
    return new ServiceError(
      `${context}: ${error.message}`,
      error.code,
      error.details
    );
  }
  if (error instanceof ServiceError) {
    return error;
  }
  return new ServiceError(
    `${context}: ${error instanceof Error ? error.message : "Unknown error"}`,
    "UNKNOWN_ERROR",
    error
  );
};
