-- AI Coach Performance Optimization Indexes
-- Created: 2025-07-05
-- Purpose: Optimize query performance for AI analysis features

-- Composite index for job fit analysis queries
-- Optimizes lookups by user_id and application_id with ordering by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_fit_analysis_user_app_created 
ON job_fit_analysis (user_id, application_id, created_at DESC);

-- Index for user-specific job fit analysis history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_fit_analysis_user_created 
ON job_fit_analysis (user_id, created_at DESC);

-- Index for application-specific analysis queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_fit_analysis_app_created 
ON job_fit_analysis (application_id, created_at DESC);

-- Optimize user resume lookups for AI analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resumes_user_current 
ON resumes (user_id, is_current) 
WHERE is_current = true;

-- Index for application permissions checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_user_id 
ON applications (user_id);

-- Partial index for active (non-archived) applications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_user_active 
ON applications (user_id, created_at DESC) 
WHERE archived = false;

-- Index to optimize subscription checks for AI features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_user_status 
ON subscriptions (user_id, status, current_period_end);

-- Index for rate limiting cleanup queries (if using database storage)
-- Note: Currently using in-memory storage, but useful for future Redis/DB migration
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_expires 
-- ON rate_limits (expires_at) 
-- WHERE expires_at > NOW();

-- Add comments for documentation
COMMENT ON INDEX idx_job_fit_analysis_user_app_created IS 'Optimizes job fit analysis queries by user and application with time ordering';
COMMENT ON INDEX idx_job_fit_analysis_user_created IS 'Optimizes user job fit history queries';
COMMENT ON INDEX idx_job_fit_analysis_app_created IS 'Optimizes application-specific analysis queries';
COMMENT ON INDEX idx_resumes_user_current IS 'Optimizes current resume lookups for AI analysis';
COMMENT ON INDEX idx_applications_user_id IS 'Optimizes application permission checks';
COMMENT ON INDEX idx_applications_user_active IS 'Optimizes active application queries';
COMMENT ON INDEX idx_subscriptions_user_status IS 'Optimizes AI feature access checks';

-- Create database statistics for query optimization
ANALYZE job_fit_analysis;
ANALYZE resumes;
ANALYZE applications;
ANALYZE subscriptions;