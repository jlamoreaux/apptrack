# Logging Setup Instructions

## Environment Variables Required

Add these to your `.env.local` for development and to your production environment:

```env
# External Logging Service Configuration
AXIOM_TOKEN=your_api_token_here
AXIOM_DATASET=your_dataset_name_here
```

## Setup Steps

1. **Create an account** with your chosen logging provider
2. **Create a dataset** (or equivalent) for your logs
3. **Generate an API token** with ingest permissions
4. **Add the environment variables** to your `.env` files

## Testing

To test in production mode locally:

```bash
NODE_ENV=production pnpm dev
```

## Log Levels

The logger supports these levels:
- `error` - Error events
- `warn` - Warning events  
- `info` - Informational messages (default)
- `debug` - Debug information
- `trace` - Detailed trace information

## Log Categories

Logs are categorized for easy filtering:
- `AUTH` - Authentication related
- `API` - API request/response
- `DATABASE` - Database operations
- `PAYMENT` - Payment processing
- `SECURITY` - Security events
- `BUSINESS` - Business metrics
- `AI_SERVICE` - AI service calls

## Viewing Logs

Logs appear in:
- Console during development
- External logging service in production (when configured)

## Note

The logger automatically:
- Redacts sensitive information
- Adds request IDs for tracing
- Tracks performance metrics
- Includes user context (hashed IDs)
- Samples logs based on environment