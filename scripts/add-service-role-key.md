# Adding Supabase Service Role Key

## Steps to get and add the service role key:

1. **Get the Service Role Key from Supabase Dashboard:**
   - Go to your Supabase project dashboard
   - Navigate to **Settings → API**
   - Find **Service role key** under **Project API keys**
   - Copy the key (it starts with `eyJ...`)
   - ⚠️ **IMPORTANT**: This key bypasses RLS and should NEVER be exposed client-side

2. **Add to your environment variables:**
   
   For local development (.env.local):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

   For production (Vercel/Railway/etc):
   - Add `SUPABASE_SERVICE_ROLE_KEY` as an environment variable
   - Set the value to your service role key
   - Redeploy your application

3. **Security Best Practices:**
   - Never commit this key to git
   - Never use in client-side code
   - Only use in server-side API routes
   - Add to .gitignore if using .env files

## What this fixes:

- Webhooks can now create subscriptions without RLS restrictions
- No security vulnerability from overly permissive RLS policies
- Proper separation of concerns between user operations and system operations

## Testing:

After adding the key and redeploying:
1. Make a test purchase in Stripe test mode
2. Check if the subscription is created in the database
3. Monitor webhook logs for any errors