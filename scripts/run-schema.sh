#!/bin/bash

# Script to run SQL schema files against Supabase
# Usage: ./scripts/run-schema.sh schemas/job_fit_analysis.sql

# Load environment variables from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Try different possible database URL variables in order of preference
if [ ! -z "$POSTGRES_URL_NON_POOLING" ]; then
    DB_URL="$POSTGRES_URL_NON_POOLING"
    echo "Using non-pooling connection"
elif [ ! -z "$POSTGRES_URL" ]; then
    DB_URL="$POSTGRES_URL"
    echo "Using pooled connection"
elif [ ! -z "$POSTGRES_PRISMA_URL" ]; then
    DB_URL="$POSTGRES_PRISMA_URL"
    echo "Using Prisma URL"
else
    echo "Error: No database URL found in .env file"
    echo "Expected one of: POSTGRES_URL_NON_POOLING, POSTGRES_URL, or POSTGRES_PRISMA_URL"
    exit 1
fi

if [ -z "$1" ]; then
    echo "Usage: $0 <sql-file>"
    echo "Example: $0 schemas/job_fit_analysis.sql"
    exit 1
fi

echo "Running SQL file: $1"
echo "Against database: ${DB_URL%%@*}@..." # Show partial URL for security

psql "$DB_URL" -f "$1"

if [ $? -eq 0 ]; then
    echo "✅ SQL file executed successfully"
else
    echo "❌ SQL execution failed"
    exit 1
fi