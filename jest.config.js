const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/fixtures/',
    '<rootDir>/__tests__/types/',
    '<rootDir>/__tests__/utils/test-helpers',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx|mjs)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverage: false,
  collectCoverageFrom: [
    'lib/**/*.ts',
    'components/**/*.tsx',
    'app/**/*.tsx',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageProvider: 'v8',
  // NOTE: Global thresholds are intentionally not set here.
  // Phase 1 covers specific utility files (80-100% per file),
  // but global coverage stays low (~11%) because the project has
  // hundreds of app/component files not yet tested.
  // Per-file thresholds should be added in Phase 2 as coverage grows.
  // coverageThreshold: { global: { lines: 60 } }  // Restore when global >50%
  testMatch: [
    '<rootDir>/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// We override transformIgnorePatterns after resolution because next/jest prepends its own patterns
// that would match jose/@upstash packages before our exceptions can take effect.
const jestConfig = createJestConfig(customJestConfig)
module.exports = async () => {
  const config = await jestConfig()
  // Override: transform ESM-only packages that babel-jest needs to process.
  // Pattern explanation: skip .pnpm outer paths (handled separately); at the inner
  // /node_modules/ level, transform jose, uncrypto, @upstash/redis, @upstash/ratelimit.
  config.transformIgnorePatterns = [
    '/node_modules/(?!\\.pnpm)(?!(?:jose|uncrypto|@upstash\\/redis|@upstash\\/ratelimit)[\\/])',
    '/node_modules/\\.pnpm/(?!(?:jose|uncrypto|@upstash\\+redis|@upstash\\+ratelimit)@)',
    '^.+\\.module\\.(css|sass|scss)$',
  ]
  return config
}
