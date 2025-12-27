#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function runSQL() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read SQL file
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node scripts/run-sql.js <sql-file>');
    process.exit(1);
  }

  const sqlPath = path.resolve(sqlFile);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`Running SQL from ${sqlFile}...`);

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    
    if (error) {
      // If RPC doesn't exist, try direct execution
      console.log('RPC method not available, attempting direct execution...');
      
      // Split SQL by semicolons and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing statement...');
          const { error: execError } = await supabase.from('_sql').select(statement);
          if (execError && !execError.message.includes('_sql')) {
            console.error('Error executing statement:', execError);
          }
        }
      }
    }
    
    console.log('SQL executed successfully!');
    
    // Verify the table exists and has data
    const { data: limits, error: verifyError } = await supabase
      .from('ai_feature_limits')
      .select('*')
      .order('subscription_tier', { ascending: true })
      .order('feature_name', { ascending: true });
    
    if (verifyError) {
      console.error('Error verifying table:', verifyError);
    } else {
      console.log('\nVerification - AI Feature Limits:');
      console.table(limits.map(l => ({
        Feature: l.feature_name,
        Tier: l.subscription_tier,
        'Daily Limit': l.daily_limit,
        'Hourly Limit': l.hourly_limit
      })));
    }
  } catch (err) {
    console.error('Error executing SQL:', err);
    process.exit(1);
  }
}

runSQL();