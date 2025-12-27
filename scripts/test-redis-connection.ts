/**
 * Script to test Redis/Vercel KV connection
 * Run with: npx tsx scripts/test-redis-connection.ts
 */

import { config } from 'dotenv';
config(); // Load .env file

// Import Redis directly to ensure env vars are loaded
import { Redis } from "@upstash/redis";

async function testRedisConnection() {
  console.log('🔍 Testing Redis/Vercel KV Connection...\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('- KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✅ Set' : '❌ Not set');
  console.log('- KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('- KV_URL:', process.env.KV_URL ? '✅ Set' : '❌ Not set');
  console.log('- REDIS_URL:', process.env.REDIS_URL ? '✅ Set' : '❌ Not set');
  console.log();

  // Initialize Redis client directly
  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  if (!redis) {
    console.error('❌ Redis client not initialized. Check your environment variables.');
    process.exit(1);
  }

  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic Connection');
    await redis.ping();
    console.log('✅ Connected to Redis successfully!\n');

    // Test 2: Set and get a value
    console.log('Test 2: Set/Get Operations');
    const testKey = 'test:connection';
    const testValue = { timestamp: new Date().toISOString(), test: true };
    
    await redis.set(testKey, JSON.stringify(testValue), { ex: 60 }); // Expire in 60 seconds
    console.log(`✅ Set value for key '${testKey}'`);
    
    const retrieved = await redis.get(testKey);
    console.log(`✅ Retrieved value:`, retrieved);
    console.log();

    // Test 3: Rate limiting keys
    console.log('Test 3: Rate Limiting Keys');
    const userId = 'test-user-123';
    const feature = 'test_feature';
    
    // Simulate rate limit tracking
    const hourlyKey = `usage:${userId}:${feature}:hourly`;
    const dailyKey = `usage:${userId}:${feature}:daily`;
    
    // Increment counters
    const hourlyCount = await redis.incr(hourlyKey);
    const dailyCount = await redis.incr(dailyKey);
    
    // Set expiration
    await redis.expire(hourlyKey, 3600); // 1 hour
    await redis.expire(dailyKey, 86400); // 24 hours
    
    console.log(`✅ Hourly counter: ${hourlyCount}`);
    console.log(`✅ Daily counter: ${dailyCount}`);
    console.log();

    // Test 4: Check TTL
    console.log('Test 4: TTL (Time To Live)');
    const ttlHourly = await redis.ttl(hourlyKey);
    const ttlDaily = await redis.ttl(dailyKey);
    
    console.log(`✅ Hourly key expires in: ${ttlHourly} seconds`);
    console.log(`✅ Daily key expires in: ${ttlDaily} seconds`);
    console.log();

    // Cleanup
    console.log('Cleaning up test keys...');
    await redis.del(testKey, hourlyKey, dailyKey);
    console.log('✅ Test keys deleted\n');

    console.log('🎉 All tests passed! Redis/Vercel KV is working correctly.');
    console.log('\nYour rate limiting system is ready to use!');

  } catch (error) {
    console.error('❌ Redis connection test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check your Vercel dashboard for the correct KV credentials');
    console.error('2. Make sure you copied KV_REST_API_URL and KV_REST_API_TOKEN');
    console.error('3. Verify your KV database is active in Vercel');
    process.exit(1);
  }
}

// Run the test
testRedisConnection().catch(console.error);