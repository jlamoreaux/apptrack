import {
  buildStaleGroups,
  daysBetween,
  TERMINAL_STATUSES,
  type StaleApplicationRow,
} from '@/lib/email/stale-reminders';

const NOW = new Date('2026-06-08T12:00:00Z');

function row(overrides: Partial<StaleApplicationRow>): StaleApplicationRow {
  return {
    id: 'app-1',
    user_id: 'user-1',
    company: 'Acme',
    role: 'Engineer',
    status: 'Applied',
    updated_at: '2026-06-01T12:00:00Z',
    email: 'a@example.com',
    full_name: 'Ada Lovelace',
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('counts whole days between two dates', () => {
    expect(daysBetween(new Date('2026-06-01T12:00:00Z'), NOW)).toBe(7);
  });
});

describe('buildStaleGroups', () => {
  it('groups multiple jobs under one user', () => {
    const groups = buildStaleGroups(
      [
        row({ id: 'a1', company: 'Acme' }),
        row({ id: 'a2', company: 'Globex' }),
      ],
      NOW
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].jobs).toHaveLength(2);
    expect(groups[0].email).toBe('a@example.com');
    expect(groups[0].firstName).toBe('Ada');
    expect(groups[0].jobs[0].daysSinceUpdate).toBe(7);
  });

  it('separates jobs across different users', () => {
    const groups = buildStaleGroups(
      [
        row({ id: 'a1', user_id: 'user-1', email: 'a@example.com' }),
        row({ id: 'b1', user_id: 'user-2', email: 'b@example.com' }),
      ],
      NOW
    );
    expect(groups).toHaveLength(2);
  });

  it('treats Interviewed as still-open (not terminal)', () => {
    // Interviewed must NOT be in the terminal exclusion set — the user is still
    // waiting to hear back.
    expect(TERMINAL_STATUSES).toEqual(['Offer', 'Hired', 'Rejected']);
    expect(TERMINAL_STATUSES).not.toContain('Interviewed');
    expect(TERMINAL_STATUSES).not.toContain('Interview Scheduled');
  });
});
