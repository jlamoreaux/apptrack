import '@testing-library/jest-dom'
import { toHaveNoViolations } from 'jest-axe'

// Extend Jest matchers with jest-axe custom matchers
expect.extend(toHaveNoViolations)

// Setup Next.js request/response mocks
global.Request = class MockRequest {
  constructor(url, init) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this.body = init?.body;
  }
  
  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
  
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
  
  async formData() {
    return this.body instanceof FormData ? this.body : new FormData();
  }
}

global.NextRequest = class MockNextRequest extends global.Request {
  constructor(url, init) {
    super(url, init);
  }
}

global.Response = class MockResponse {
  constructor(body, init) {
    this._body = body;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.headers = new Map(Object.entries(init?.headers || {}));
  }
  
  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
  
  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
  
  static json(data, init) {
    const response = new MockResponse(JSON.stringify(data), init);
    response._body = data;
    return response;
  }
}

global.NextResponse = class MockNextResponse extends global.Response {
  constructor(body, init) {
    super(body, init);
  }
  
  static json(data, init) {
    const response = new MockNextResponse(JSON.stringify(data), init);
    response._body = data;
    return response;
  }
}

// Mock next/server module
jest.mock('next/server', () => ({
  NextRequest: global.NextRequest,
  NextResponse: global.NextResponse,
}))

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

// Mock Replicate module
jest.mock('replicate', () => {
  return jest.fn().mockImplementation(() => ({
    run: jest.fn(),
  }))
})

// Mock fetch for tests
global.fetch = jest.fn()

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
  Target: () => <div data-testid="target-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Lightbulb: () => <div data-testid="lightbulb-icon" />,
  CheckCircle2: () => <div data-testid="check-circle2-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  Download: () => <div data-testid="download-icon" />,
  // AI Coach specific icons
  Brain: () => <div data-testid="brain-icon" />,
  MessageCircle: () => <div data-testid="message-circle-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  Lock: () => <div data-testid="lock-icon" />,
  Crown: () => <div data-testid="crown-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  Progress: () => <div data-testid="progress-icon" />,
}))

// Mock window.matchMedia for components that use prefers-reduced-motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks()
})

// Configure axe with color-contrast enabled (we've fixed the color issues)
const axeConfig = {
  rules: {
    // Enable color-contrast rule since we've implemented accessible colors
    'color-contrast': { enabled: true },
  },
}

global.axeConfig = axeConfig