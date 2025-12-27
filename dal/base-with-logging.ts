import { createClient } from "@/lib/supabase/server";
import { loggerService, LogCategory } from "@/lib/services/logger.service";
import { LoggerUtils } from "@/lib/services/logger.utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

export interface QueryContext {
  requestId?: string;
  userId?: string;
  operation?: string;
}

/**
 * Enhanced BaseDAL with comprehensive logging
 * This is an example of how to integrate logging into the existing DAL pattern
 */
export abstract class BaseDAL {
  protected supabase: SupabaseClient | null = null;
  private queryContext: QueryContext = {};
  
  constructor(context?: QueryContext) {
    if (context) {
      this.queryContext = context;
    }
  }
  
  /**
   * Set context for all queries in this DAL instance
   */
  setContext(context: QueryContext): void {
    this.queryContext = { ...this.queryContext, ...context };
  }
  
  /**
   * Get or create Supabase client
   */
  protected async getClient(): Promise<SupabaseClient> {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }
  
  /**
   * Execute query with comprehensive logging
   */
  protected async executeQuery<T>(
    operation: string,
    table: string,
    queryFn: () => Promise<T>,
    options?: {
      expectedCount?: number;
      warnThreshold?: number;
      sensitiveData?: boolean;
    }
  ): Promise<T> {
    const queryId = uuidv4();
    const startTime = performance.now();
    
    // Create query-specific logger
    const queryLogger = loggerService.child({
      requestId: this.queryContext.requestId,
      userId: this.queryContext.userId,
      category: LogCategory.DATABASE,
      metadata: {
        queryId,
        operation,
        table
      }
    });
    
    queryLogger.debug(`Starting ${operation} on ${table}`);
    
    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;
      
      // Log the query execution
      loggerService.logDatabaseQuery(operation, table, duration, undefined, {
        requestId: this.queryContext.requestId,
        userId: this.queryContext.userId,
        queryId,
        resultCount: this.getResultCount(result),
        metadata: {
          expectedCount: options?.expectedCount
        }
      });
      
      // Check expected count if provided
      if (options?.expectedCount !== undefined) {
        const actualCount = this.getResultCount(result);
        if (actualCount !== options.expectedCount) {
          queryLogger.warn(`Unexpected result count`, {
            metadata: {
              expected: options.expectedCount,
              actual: actualCount
            }
          });
        }
      }
      
      // Log sensitive data access if flagged
      if (options?.sensitiveData) {
        loggerService.logSecurityEvent('sensitive_data_access', 'low', {
          operation,
          table,
          queryId,
          userId: this.queryContext.userId
        }, {
          requestId: this.queryContext.requestId
        });
      }
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Log the error with full context
      queryLogger.error(`Query failed: ${operation} on ${table}`, error as Error, {
        duration,
        metadata: {
          queryId,
          errorCode: LoggerUtils.extractErrorCode(error),
          errorType: LoggerUtils.classifyError(error)
        }
      });
      
      // Log to database query logger
      loggerService.logDatabaseQuery(operation, table, duration, error as Error, {
        requestId: this.queryContext.requestId,
        userId: this.queryContext.userId,
        queryId,
        metadata: {
          errorCode: LoggerUtils.extractErrorCode(error)
        }
      });
      
      // Additional logging for specific error types
      if (this.isPermissionError(error)) {
        loggerService.logSecurityEvent('database_permission_denied', 'high', {
          operation,
          table,
          queryId,
          userId: this.queryContext.userId,
          error: (error as Error).message
        }, {
          requestId: this.queryContext.requestId
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Execute transaction with logging
   */
  protected async executeTransaction<T>(
    transactionName: string,
    transactionFn: () => Promise<T>
  ): Promise<T> {
    const transactionId = uuidv4();
    const startTime = performance.now();
    
    const transactionLogger = loggerService.child({
      requestId: this.queryContext.requestId,
      userId: this.queryContext.userId,
      category: LogCategory.DATABASE,
      metadata: {
        transactionId,
        transactionName
      }
    });
    
    transactionLogger.info(`Starting transaction: ${transactionName}`);
    
    try {
      const result = await transactionFn();
      const duration = performance.now() - startTime;
      
      transactionLogger.info(`Transaction completed: ${transactionName}`, {
        duration,
        metadata: {
          success: true
        }
      });
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      transactionLogger.error(`Transaction failed: ${transactionName}`, error as Error, {
        duration,
        metadata: {
          success: false
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Execute batch operation with logging
   */
  protected async executeBatchOperation<T, R>(
    operationName: string,
    items: T[],
    batchSize: number,
    processFn: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const batchId = uuidv4();
    const startTime = performance.now();
    const results: R[] = [];
    
    const batchLogger = loggerService.child({
      requestId: this.queryContext.requestId,
      userId: this.queryContext.userId,
      category: LogCategory.DATABASE,
      metadata: {
        batchId,
        operationName,
        totalItems: items.length,
        batchSize
      }
    });
    
    batchLogger.info(`Starting batch operation: ${operationName}`);
    
    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const batchStartTime = performance.now();
        
        batchLogger.debug(`Processing batch ${batchNumber}`, {
          metadata: {
            batchNumber,
            batchItems: batch.length
          }
        });
        
        const batchResults = await processFn(batch);
        results.push(...batchResults);
        
        const batchDuration = performance.now() - batchStartTime;
        
        batchLogger.debug(`Batch ${batchNumber} completed`, {
          duration: batchDuration,
          metadata: {
            batchNumber,
            processedItems: batchResults.length
          }
        });
      }
      
      const totalDuration = performance.now() - startTime;
      
      batchLogger.info(`Batch operation completed: ${operationName}`, {
        duration: totalDuration,
        metadata: {
          totalBatches: Math.ceil(items.length / batchSize),
          totalProcessed: results.length,
          avgTimePerItem: totalDuration / items.length
        }
      });
      
      return results;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      batchLogger.error(`Batch operation failed: ${operationName}`, error as Error, {
        duration,
        metadata: {
          processedSoFar: results.length
        }
      });
      
      throw error;
    }
  }
  
  // Helper methods
  private getResultCount(result: any): number {
    if (Array.isArray(result)) {
      return result.length;
    }
    if (result && typeof result === 'object') {
      if ('data' in result && Array.isArray(result.data)) {
        return result.data.length;
      }
      if ('count' in result && typeof result.count === 'number') {
        return result.count;
      }
    }
    return 1;
  }
  
  private isPermissionError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = LoggerUtils.extractErrorCode(error)?.toLowerCase() || '';
    
    return message.includes('permission') || 
           message.includes('unauthorized') ||
           message.includes('forbidden') ||
           code === '42501' || // PostgreSQL insufficient privilege
           code === 'pgrst301'; // PostgREST unauthorized
  }
}