/**
 * Interview Preparation Response Transformer Service
 *
 * Centralized service for handling all interview prep content transformations
 * including parsing, validation, caching, and context extraction.
 */

import { parseInterviewPreparation } from "@/lib/ai-coach/response-parser";
import type { InterviewPreparationResult } from "@/types/ai-analysis";
import {
  getEnvironmentConfig,
  InterviewPrepValidation,
  type InterviewPrepCategory,
  type InterviewPrepDifficulty,
} from "@/lib/config/interview-prep";
import {
  getInterviewPrepMonitor,
  MonitoringUtils,
} from "@/lib/monitoring/interview-prep-monitor";

// Type definitions
export interface JobContext {
  company: string;
  role: string;
}

export interface TransformationRequest {
  content: string | InterviewPreparationResult | null;
  structured: boolean;
  jobDescription: string;
  isExistingContent?: boolean;
}

export interface TransformationResult {
  content: string | InterviewPreparationResult;
  fromCache: boolean;
  transformationTime: number;
}

export interface TransformationError {
  type: "validation" | "parsing" | "context_extraction" | "unknown";
  message: string;
  originalContent: any;
  fallbackUsed: boolean;
}

/**
 * Main service class for interview preparation transformations
 */
export class InterviewPrepTransformerService {
  private transformationCache = new Map<
    string,
    {
      result: InterviewPreparationResult;
      timestamp: number;
      jobContext: JobContext;
    }
  >();

  private readonly config = getEnvironmentConfig();
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Transform content based on request parameters
   */
  async transform(
    request: TransformationRequest
  ): Promise<TransformationResult> {
    const monitor = getInterviewPrepMonitor();
    const requestId = this.generateRequestId();

    return MonitoringUtils.recordTransformation(
      async () => this.performTransform(request),
      {
        structured: request.structured,
        isExistingContent: request.isExistingContent,
        contentType: typeof request.content,
        hasJobDescription: !!request.jobDescription,
      },
      undefined, // userId would come from route context
      requestId
    );
  }

  /**
   * Internal transform implementation
   */
  private async performTransform(
    request: TransformationRequest
  ): Promise<TransformationResult> {
    const startTime = Date.now();

    try {
      // Handle null/undefined content
      if (!request.content) {
        throw new Error(this.config.ERROR_MESSAGES.NO_CONTENT);
      }

      // Extract job context once
      const jobContext = this.extractJobContext(request.jobDescription);

      // Check cache first for structured requests (if enabled)
      if (
        this.config.FEATURES.ENABLE_CACHING &&
        request.structured &&
        typeof request.content === "string"
      ) {
        const cacheKey = this.generateCacheKey(request.content, jobContext);
        const cached = this.getCachedResult(cacheKey);

        if (cached) {
          this.cacheHits++;
          MonitoringUtils.recordCacheHit({
            cacheKey: cacheKey.substring(0, 8),
            jobContext: jobContext,
          });
          return {
            content: cached,
            fromCache: true,
            transformationTime: Date.now() - startTime,
          };
        }
        this.cacheMisses++;
        MonitoringUtils.recordCacheMiss({
          cacheKey: cacheKey.substring(0, 8),
          jobContext: jobContext,
        });
      }

      // Perform transformation
      const transformedContent = this.performTransformation(
        request.content,
        request.structured,
        jobContext
      );

      // Cache structured results (if enabled)
      if (
        this.config.FEATURES.ENABLE_CACHING &&
        request.structured &&
        typeof request.content === "string" &&
        typeof transformedContent === "object"
      ) {
        const cacheKey = this.generateCacheKey(request.content, jobContext);
        this.cacheResult(cacheKey, transformedContent, jobContext);
      }

      return {
        content: transformedContent,
        fromCache: false,
        transformationTime: Date.now() - startTime,
      };
    } catch (error) {
      if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      }

      // Return safe fallback
      const fallbackContent = this.createFallbackContent(
        request.content,
        request.structured
      );

      const transformationTime = Date.now() - startTime;

      // Log slow transformations
      if (
        this.config.FEATURES.ENABLE_PERFORMANCE_MONITORING &&
        transformationTime > this.config.PERFORMANCE.SLOW_TRANSFORMATION_MS
      ) {
      }

      return {
        content: fallbackContent,
        fromCache: false,
        transformationTime,
      };
    }
  }

  /**
   * Perform the actual content transformation
   */
  private performTransformation(
    content: string | InterviewPreparationResult | null,
    structured: boolean,
    jobContext: JobContext
  ): string | InterviewPreparationResult {
    // Handle already structured content
    if (typeof content === "object" && content !== null) {
      if (structured) {
        // Validate existing structured content
        if (this.validateStructuredContent(content)) {
          return content;
        }
        // If invalid, convert to string and re-parse
        content = this.structuredToString(content);
      } else {
        // Convert structured to string
        return this.structuredToString(content);
      }
    }

    // Handle string content
    if (typeof content === "string") {
      if (structured) {
        try {
          // Parse string to structured format
          const parsed = parseInterviewPreparation(content, jobContext);

          // Validate the parsed result
          if (!this.validateStructuredContent(parsed)) {
            MonitoringUtils.recordValidationFailure({
              reason: "parsed_content_validation_failed",
              contentLength: content.length,
              jobContext,
            });
            if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
                "Parsed content failed validation, returning original string"
              );
            }
            return content;
          }

          return parsed;
        } catch (error) {
          // If parsing fails, return original content
          if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
          }
          return content;
        }
      } else {
        // Return string as-is
        return content;
      }
    }

    // Fallback for unexpected types
    return String(content || "Unable to process content");
  }

  /**
   * Extract company and role context from job description
   */
  extractJobContext(jobDescription: string): JobContext {
    try {
      if (!jobDescription || typeof jobDescription !== "string") {
        return {
          company: this.config.DEFAULTS.COMPANY_NAME,
          role: this.config.DEFAULTS.ROLE_NAME,
        };
      }

      return {
        company: this.extractCompanyName(jobDescription),
        role: this.extractRoleName(jobDescription),
      };
    } catch (error) {
      if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      }
      return {
        company: this.config.DEFAULTS.COMPANY_NAME,
        role: this.config.DEFAULTS.ROLE_NAME,
      };
    }
  }

  /**
   * Extract company name with improved error handling and validation
   */
  private extractCompanyName(jobDescription: string): string {
    try {
      const limitedDescription = jobDescription.slice(
        0,
        this.config.PARSING.MAX_JOB_DESCRIPTION_LENGTH
      );

      // Helper to clean company names (remove trailing punctuation/commas)
      const cleanCompanyName = (name: string): string => {
        // Remove trailing punctuation except parentheses
        return name.replace(/[,.\s]+$/, "").trim();
      };

      // First, try to find standalone company lines (e.g., "Google Inc." on its own line)
      const lines = limitedDescription.split("\n");
      for (const line of lines) {
        const trimmedLine = line.trim();
        // Check for company indicators
        if (
          trimmedLine.match(
            /^[A-Z][a-zA-Z0-9\s&(),-]+(?:Inc|LLC|Ltd|Corp|Corporation|Company)\.?$/
          )
        ) {
          const cleaned = cleanCompanyName(trimmedLine);
          if (InterviewPrepValidation.isValidCompanyName(cleaned)) {
            return cleaned;
          }
        }
        // Also check for simple company names on their own line (2nd or 3rd line often has company)
        if (
          lines.indexOf(line) <= 2 &&
          trimmedLine.match(/^[A-Z][a-zA-Z0-9\s&(),-]+\.?$/) &&
          trimmedLine.length > 2 &&
          trimmedLine.length < 50 &&
          !trimmedLine.match(
            /^(Senior|Junior|Lead|Principal|Staff|Product|Software|Backend|Frontend|Full|Requirements|Description|About|Join|We|This|No)/i
          )
        ) {
          const cleaned = cleanCompanyName(trimmedLine);
          if (InterviewPrepValidation.isValidCompanyName(cleaned)) {
            return cleaned;
          }
        }
      }

      for (const pattern of this.config.PATTERNS.COMPANY_EXTRACTION) {
        const match = limitedDescription.match(pattern);
        if (match && match[1]) {
          const company = match[1].trim();
          // Clean up multi-line matches
          const cleanCompany = cleanCompanyName(company.split("\n")[0].trim());
          if (
            InterviewPrepValidation.isValidCompanyName(cleanCompany) &&
            !cleanCompany.match(
              /^(Senior|Junior|Lead|Principal|Staff|Product|Software|Backend|Frontend|Full|no clear|unclear|unknown)/i
            )
          ) {
            return cleanCompany;
          }
        }
      }

      return this.config.DEFAULTS.COMPANY_NAME;
    } catch (error) {
      if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      }
      return this.config.DEFAULTS.COMPANY_NAME;
    }
  }

  /**
   * Extract role name with improved error handling and validation
   */
  private extractRoleName(jobDescription: string): string {
    try {
      const limitedDescription = jobDescription.slice(
        0,
        this.config.PARSING.MAX_JOB_DESCRIPTION_LENGTH
      );

      // Check for "Role at Company" format first
      const roleAtCompanyMatch = limitedDescription.match(
        /([A-Za-z\s]+)(?:\s+at\s+|\s+@\s+)([A-Z][A-Za-z0-9\s&.,-]+)/i
      );
      if (roleAtCompanyMatch && roleAtCompanyMatch[1]) {
        const role = roleAtCompanyMatch[1].trim();
        if (InterviewPrepValidation.isValidRoleName(role)) {
          return role;
        }
      }

      // First, check the first line - often contains the role
      const lines = limitedDescription.split("\n");
      const firstLine = lines[0]?.trim();
      if (firstLine && firstLine.length > 2 && firstLine.length < 100) {
        // Check if it looks like a role title (e.g., "Senior Software Engineer - Backend")
        const roleMatch = firstLine.match(
          /^([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Manager|Designer|Analyst|Architect|Lead|Director|Specialist|Consultant))/i
        );
        if (roleMatch && roleMatch[1]) {
          const cleanRole = roleMatch[1].trim().replace(/\s*-\s*.*$/, ""); // Remove anything after dash
          if (InterviewPrepValidation.isValidRoleName(cleanRole)) {
            return cleanRole;
          }
        }
      }

      for (const pattern of this.config.PATTERNS.ROLE_EXTRACTION) {
        const match = limitedDescription.match(pattern);
        if (match && match[1]) {
          let role = match[1].trim();
          // Clean up role extraction (remove "an", "a", or "experienced" prefix if captured)
          role = role.replace(/^(an?\s+|experienced\s+)+/i, "");
          // Take only the first line if multi-line
          role = role.split("\n")[0].trim();
          if (
            InterviewPrepValidation.isValidRoleName(role) &&
            !role.match(/^(at|with|for|to|who|in|and|or|the|we|our|is|are)/i)
          ) {
            return role;
          }
        }
      }

      return this.config.DEFAULTS.ROLE_NAME;
    } catch (error) {
      if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      }
      return this.config.DEFAULTS.ROLE_NAME;
    }
  }

  /**
   * Validate structured content
   */
  private validateStructuredContent(
    content: InterviewPreparationResult
  ): boolean {
    try {
      if (!content || typeof content !== "object") return false;

      // Check required arrays
      const requiredArrayFields = [
        "questions",
        "generalTips",
        "companyInsights",
        "roleSpecificAdvice",
        "practiceAreas",
      ];
      for (const field of requiredArrayFields) {
        if (
          !Array.isArray(content[field as keyof InterviewPreparationResult])
        ) {
          return false;
        }
      }

      // Validate questions array and count
      if (
        !Array.isArray(content.questions) ||
        content.questions.length < this.config.VALIDATION.MIN_QUESTIONS ||
        content.questions.length > this.config.VALIDATION.MAX_QUESTIONS
      ) {
        return false;
      }

      // Validate each question
      for (const question of content.questions) {
        // Check required fields
        for (const field of this.config.VALIDATION.REQUIRED_QUESTION_FIELDS) {
          if (!question[field as keyof typeof question]) {
            return false;
          }
        }

        // Validate category and difficulty
        if (
          !InterviewPrepValidation.isValidCategory(question.category) ||
          !InterviewPrepValidation.isValidDifficulty(question.difficulty)
        ) {
          return false;
        }
      }

      // Validate estimated duration
      if (!InterviewPrepValidation.isValidDuration(content.estimatedDuration)) {
        return false;
      }

      // Validate generated date
      if (!content.generatedAt || typeof content.generatedAt !== "string") {
        return false;
      }

      const date = new Date(content.generatedAt);
      if (isNaN(date.getTime())) {
        return false;
      }

      return true;
    } catch (error) {
      if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      }
      return false;
    }
  }

  /**
   * Convert structured content to string representation
   */
  private structuredToString(content: InterviewPreparationResult): string {
    try {
      return JSON.stringify(content, null, 2);
    } catch (error) {
      return "Error processing structured content";
    }
  }

  /**
   * Create fallback content when transformation fails
   */
  private createFallbackContent(
    originalContent: any,
    structured: boolean
  ): string | InterviewPreparationResult {
    if (structured) {
      // Return minimal valid structured content using config values
      return {
        questions: [
          {
            id: this.config.DEFAULTS.FALLBACK_QUESTION_ID,
            category: "behavioral" as InterviewPrepCategory,
            question: "Tell me about yourself.",
            suggestedApproach:
              "Provide a brief professional summary highlighting relevant experience.",
            difficulty: "easy" as InterviewPrepDifficulty,
          },
        ],
        generalTips: [
          "Be confident and prepared",
          "Research the company thoroughly",
        ],
        companyInsights: ["Learn about company culture and values"],
        roleSpecificAdvice: ["Understand the specific role requirements"],
        practiceAreas: [
          "Common behavioral questions",
          "Role-specific scenarios",
        ],
        estimatedDuration: this.config.DEFAULTS.ESTIMATED_DURATION,
        generatedAt: new Date().toISOString(),
      } as InterviewPreparationResult;
    } else {
      // Return string representation
      if (typeof originalContent === "string") {
        return originalContent;
      }
      return this.config.ERROR_MESSAGES.FALLBACK_CONTENT;
    }
  }

  /**
   * Generate cache key for content and context
   */
  private generateCacheKey(content: string, jobContext: JobContext): string {
    const contentHash = this.simpleHash(content);
    const contextHash = this.simpleHash(
      `${jobContext.company}-${jobContext.role}`
    );
    return `${contentHash}-${contextHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult(cacheKey: string): InterviewPreparationResult | null {
    const cached = this.transformationCache.get(cacheKey);

    if (!cached) return null;

    // Check expiration
    if (Date.now() - cached.timestamp > this.config.CACHE.EXPIRATION_MS) {
      this.transformationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache transformation result
   */
  private cacheResult(
    cacheKey: string,
    result: InterviewPreparationResult,
    jobContext: JobContext
  ): void {
    try {
      // Check cache size limit
      if (this.transformationCache.size >= this.config.CACHE.MAX_ENTRIES) {
        this.cleanExpiredCache();

        // If still at limit, remove oldest entry
        if (this.transformationCache.size >= this.config.CACHE.MAX_ENTRIES) {
          const oldestKey = this.findOldestCacheKey();
          if (oldestKey) {
            this.transformationCache.delete(oldestKey);
          }
        }
      }

      this.transformationCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        jobContext,
      });

      // Clean expired entries periodically
      this.cleanExpiredCache();
    } catch (error) {
      if (this.config.FEATURES.ENABLE_DETAILED_LOGGING) {
      }
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();

    for (const [key, cached] of this.transformationCache.entries()) {
      if (now - cached.timestamp > this.config.CACHE.EXPIRATION_MS) {
        this.transformationCache.delete(key);
      }
    }
  }

  /**
   * Find the oldest cache key for eviction
   */
  private findOldestCacheKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, cached] of this.transformationCache.entries()) {
      if (cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: number | null;
    maxSize: number;
    totalRequests: number;
  } {
    const size = this.transformationCache.size;
    const now = Date.now();
    let oldestEntry: number | null = null;

    for (const cached of this.transformationCache.values()) {
      if (oldestEntry === null || cached.timestamp < oldestEntry) {
        oldestEntry = cached.timestamp;
      }
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    // Log warning if hit rate is low
    if (
      this.config.FEATURES.ENABLE_PERFORMANCE_MONITORING &&
      totalRequests > 10 &&
      hitRate < this.config.PERFORMANCE.CACHE_HIT_RATE_WARNING
    ) {
        `Low cache hit rate detected: ${(hitRate * 100).toFixed(1)}%`
      );
    }

    return {
      size,
      hitRate,
      oldestEntry: oldestEntry ? now - oldestEntry : null,
      maxSize: this.config.CACHE.MAX_ENTRIES,
      totalRequests,
    };
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.transformationCache.clear();
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
