# Database Schemas

This directory contains SQL schema definitions for the AppTrack application.

## Active Schemas (Currently in Use)

- `applications.sql` - Main applications table
- `linkedin_profiles.sql` - **ACTIVE** - Simple per-user LinkedIn profiles storage
- `migrations/` - All migration files that have been applied

## Inactive/Proposed Schemas (NOT in Use)

- `linkedin_profiles_normalized.sql` - **NOT ACTIVE** - Normalized design for shared LinkedIn profiles (proposed but not implemented)

## Important Notes

### LinkedIn Profiles Implementation
The application currently uses the **simple, denormalized** `linkedin_profiles.sql` schema where:
- Each LinkedIn profile entry is unique per user per application
- Profile data (name, title, company) is private to each user
- No data sharing between users

The normalized schema (`linkedin_profiles_normalized.sql`) was designed as a potential enhancement but is **NOT implemented**.

## Running Migrations

To apply a migration:
```bash
./scripts/run-schema.sh schemas/migrations/your_migration.sql
```