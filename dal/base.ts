// Base interface for all DAL classes
export interface BaseDAL<T, CreateInput, UpdateInput> {
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

// Common error types for DAL operations
export class DALError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = "DALError";
  }
}

export class NotFoundError extends DALError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends DALError {
  constructor(message: string, details?: any) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class PermissionError extends DALError {
  constructor(message: string) {
    super(message, "PERMISSION_DENIED");
    this.name = "PermissionError";
  }
}

// Common result types
export interface DALResult<T> {
  success: boolean;
  data?: T;
  error?: DALError;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
