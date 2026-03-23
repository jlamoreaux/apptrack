/**
 * Tests for getApplications query resilience
 *
 * Regression: getApplications previously used a PostgREST join on the
 * application_ai_analyses materialized view. PostgREST can't auto-detect
 * FK relationships on materialized views, so the entire query silently
 * failed and returned [], hiding all applications from the dashboard
 * (including the pipeline chart).
 *
 * The fix splits the query into two parallel fetches. These tests ensure
 * applications are always returned even when the analyses query fails.
 */

import { getApplications } from '@/lib/supabase/queries';

// Mock the Supabase client — queries.ts imports from ./server-client
const mockFrom = jest.fn();
jest.mock('@/lib/supabase/server-client', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

/**
 * Builds a chainable Supabase query mock where every method returns the chain,
 * and the chain itself is thenable (awaitable) resolving to the given result.
 * Uses plain functions instead of jest.fn() to avoid breaking thenability.
 */
function mockSupabaseChain(result: { data: any; error: any }) {
  const chain: any = {
    then: (onFulfilled: any, onRejected?: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    select: () => chain,
    eq: () => chain,
    order: () => chain,
  };
  return chain;
}

const sampleApps = [
  { id: 'app-1', user_id: 'user-1', company: 'Acme', status: 'Applied', archived: false },
  { id: 'app-2', user_id: 'user-1', company: 'Beta', status: 'Hired', archived: false },
];

describe('getApplications', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('returns applications even when analyses query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'applications')
        return mockSupabaseChain({ data: sampleApps, error: null });
      if (table === 'application_ai_analyses')
        return mockSupabaseChain({
          data: null,
          error: { message: 'relation not found', code: 'PGRST200' },
        });
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getApplications('user-1');

    expect(result).toHaveLength(2);
    expect(result[0].company).toBe('Acme');
    expect(result[1].company).toBe('Beta');
    expect(result[0].ai_analyses).toBeUndefined();
  });

  it('returns applications with analyses when both queries succeed', async () => {
    const analyses = [
      { application_id: 'app-1', job_fit_count: 2, best_fit_score: 85 },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'applications')
        return mockSupabaseChain({ data: sampleApps, error: null });
      if (table === 'application_ai_analyses')
        return mockSupabaseChain({ data: analyses, error: null });
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getApplications('user-1');

    expect(result).toHaveLength(2);
    expect(result[0].ai_analyses).toEqual(analyses[0]);
    expect(result[1].ai_analyses).toBeUndefined();
  });

  it('returns empty array when applications query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'applications')
        return mockSupabaseChain({
          data: null,
          error: { message: 'auth error', code: 'PGRST301' },
        });
      if (table === 'application_ai_analyses')
        return mockSupabaseChain({ data: [], error: null });
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getApplications('user-1');

    expect(result).toEqual([]);
  });
});
