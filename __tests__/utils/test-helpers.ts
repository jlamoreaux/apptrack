/**
 * Test Utilities and Helper Functions
 * Provides factory functions and utilities for creating mock data in tests
 */

import type { UserResume, User, Application } from '@/types';

/**
 * Creates a mock user with optional overrides
 */
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock resume with optional overrides
 */
export const createMockResume = (overrides?: Partial<UserResume>): UserResume => ({
  id: 'resume-456',
  user_id: 'test-user-123',
  name: 'My Resume',
  description: 'Software Engineer Resume',
  file_url: 'https://example.com/resume.pdf',
  file_type: 'application/pdf',
  extracted_text: 'Resume content here with React and Node.js experience',
  is_default: false,
  display_order: 1,
  uploaded_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock subscription with optional plan name
 */
export const createMockSubscription = (planName: string, userId: string = 'test-user-123') => ({
  id: `sub-${planName}-123`,
  user_id: userId,
  plan_id: `plan-${planName}`,
  status: 'active' as const,
  current_period_start: '2024-01-01',
  current_period_end: '2024-02-01',
  cancel_at_period_end: false,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  subscription_plans: {
    id: `plan-${planName}`,
    name: planName,
    stripe_product_id: `prod_${planName}`,
    stripe_price_id: `price_${planName}`,
    price: planName === 'Free' ? 0 : planName === 'AI Coach' ? 9 : 29,
    billing_period: 'month' as const,
    features: {},
    is_active: true,
    display_order: planName === 'Free' ? 1 : planName === 'AI Coach' ? 2 : 3,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
});

/**
 * Creates a mock Supabase client with chainable methods
 */
export const createMockSupabaseClient = () => {
  const mockClient = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: createMockUser() },
        error: null,
      }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'resumes/test.pdf' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/resume.pdf' },
        }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  };

  return mockClient;
};

/**
 * Creates a tracked mock Supabase client that records call sequences
 */
export const createTrackedSupabaseClient = () => {
  const callSequence: string[] = [];

  const mockClient = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: createMockUser() },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      callSequence.push(`from(${table})`);
      return mockClient;
    }),
    select: jest.fn((cols: string) => {
      callSequence.push(`select(${cols})`);
      return mockClient;
    }),
    insert: jest.fn((data: any) => {
      callSequence.push(`insert(...)`);
      return mockClient;
    }),
    update: jest.fn((data: any) => {
      callSequence.push(`update(...)`);
      return mockClient;
    }),
    delete: jest.fn(() => {
      callSequence.push(`delete()`);
      return mockClient;
    }),
    eq: jest.fn((col: string, val: any) => {
      callSequence.push(`eq(${col}, ${val})`);
      return mockClient;
    }),
    order: jest.fn((col: string, opts: any) => {
      callSequence.push(`order(${col})`);
      return mockClient;
    }),
    limit: jest.fn((n: number) => {
      callSequence.push(`limit(${n})`);
      return mockClient;
    }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    getCallSequence: () => [...callSequence],
    clearCallSequence: () => { callSequence.length = 0; },
  };

  return mockClient;
};

/**
 * Creates a FormData object with file upload
 */
export const createFileFormData = (
  filename: string = 'resume.pdf',
  fileType: string = 'application/pdf',
  fileContent: string = 'resume content',
  additionalFields?: Record<string, string>
) => {
  const file = new File([fileContent], filename, { type: fileType });
  const formData = new FormData();
  formData.append('file', file);

  if (additionalFields) {
    Object.entries(additionalFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  return formData;
};

/**
 * Creates a Request object with JSON body
 */
export const createJSONRequest = (
  url: string,
  method: string = 'POST',
  body?: any
) => {
  return new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * Waits for a condition to be true (useful for async tests)
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 1000,
  interval: number = 50
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};
