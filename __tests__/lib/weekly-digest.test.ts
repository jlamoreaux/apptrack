import {
  buildDigestGroups,
  buildDigestInsightPrompt,
  type DigestApplicationRow,
} from '@/lib/email/weekly-digest';

const NOW = new Date('2026-06-08T12:00:00Z');

function row(overrides: Partial<DigestApplicationRow>): DigestApplicationRow {
  return {
    id: 'app-1',
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    status: 'Applied',
    created_at: '2026-05-01T12:00:00Z',
    updated_at: '2026-05-01T12:00:00Z',
    email: 'a@example.com',
    full_name: 'Ada Lovelace',
    ...overrides,
  };
}

describe('buildDigestGroups', () => {
  it('counts active, stale, and new applications', () => {
    const groups = buildDigestGroups(
      [
        // active + stale (updated long ago)
        row({ id: 'a1', status: 'Applied', updated_at: '2026-05-01T12:00:00Z' }),
        // active + fresh + new this week
        row({
          id: 'a2',
          status: 'Interviewed',
          created_at: '2026-06-05T12:00:00Z',
          updated_at: '2026-06-07T12:00:00Z',
        }),
        // terminal -> not active
        row({ id: 'a3', status: 'Rejected' }),
      ],
      NOW
    );

    expect(groups).toHaveLength(1);
    const { summary } = groups[0];
    expect(summary.activeCount).toBe(2); // Applied + Interviewed
    expect(summary.needsFollowUp).toBe(1); // the stale Applied one
    expect(summary.newThisWeek).toBe(1); // a2 created this week
    expect(summary.statusCounts).toEqual({ Applied: 1, Interviewed: 1 });
  });

  it('excludes users with no active applications', () => {
    const groups = buildDigestGroups([row({ status: 'Hired' })], NOW);
    expect(groups).toHaveLength(0);
  });
});

describe('buildDigestInsightPrompt', () => {
  it('summarizes composition and follow-ups', () => {
    const [group] = buildDigestGroups(
      [
        row({ id: 'a1', status: 'Applied', company: 'Acme', role: 'SRE' }),
        row({ id: 'a2', status: 'Applied', company: 'Globex', role: 'Dev' }),
      ],
      NOW
    );
    const prompt = buildDigestInsightPrompt(group);
    expect(prompt).toContain('2 Applied');
    expect(prompt).toContain('SRE at Acme');
  });
});
