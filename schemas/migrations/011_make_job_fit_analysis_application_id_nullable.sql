-- Migration: Make application_id nullable in job_fit_analysis
-- This allows users to run job fit analysis without creating an application first
-- (e.g., from /try pages before signup)

ALTER TABLE public.job_fit_analysis
ALTER COLUMN application_id DROP NOT NULL;
