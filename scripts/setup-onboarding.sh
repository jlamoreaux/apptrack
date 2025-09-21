#!/bin/bash

# Setup script for onboarding feature
echo "Setting up onboarding feature..."

# Run the onboarding schema
echo "Creating onboarding tables..."
npx supabase db push --file schemas/onboarding.sql

echo "Onboarding setup complete!"
echo ""
echo "The onboarding system is now ready to use."
echo "New users will automatically see the onboarding flow when they first log in."
echo ""
echo "To test the onboarding flow:"
echo "1. Log in to the dashboard"
echo "2. If you have no applications, the onboarding will automatically start"
echo "3. You can also manually trigger it by clearing your onboarding data in Supabase"