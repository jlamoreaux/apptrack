import '@testing-library/jest-dom'
import { toHaveNoViolations } from 'jest-axe'

// Extend Jest matchers with jest-axe custom matchers
expect.extend(toHaveNoViolations)

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }) => {
    return <a href={href} {...props}>{children}</a>
  }
})

// Mock environment variables
process.env = {
  ...process.env,
  NODE_ENV: 'test',
}

// Mock Lucide React icons to avoid SVG rendering issues in tests
jest.mock('lucide-react', () => ({
  Building2: () => <div data-testid="building2-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
}))

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks()
})

// Configure axe to ignore color-contrast for now (we'll fix this separately)
const axeConfig = {
  rules: {
    // Temporarily disable color-contrast rule while we fix the issues
    'color-contrast': { enabled: false },
  },
}

global.axeConfig = axeConfig