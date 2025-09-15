#!/bin/bash

# Script to run the job_description migration
# This adds the job_description field to the applications table

echo "Running migration to add job_description field to applications table..."
echo ""
echo "This migration will:"
echo "1. Add a job_description text column to the applications table"
echo "2. Create a GIN index for full-text search on job descriptions"
echo ""
echo "Note: You'll need to run this against your Supabase database"
echo ""
echo "Migration SQL:"
echo "=============="
cat migrations/002_add_job_description_to_applications.sql
echo ""
echo "=============="
echo ""
echo "To apply this migration:"
echo "1. Go to your Supabase dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Paste the above SQL and run it"
echo ""
echo "Or run via Supabase CLI:"
echo "supabase db push"