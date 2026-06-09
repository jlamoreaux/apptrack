import {
  staleReminderTemplate,
  weeklyDigestTemplate,
} from '@/lib/email/templates/lifecycle';

const base = {
  firstName: 'Ada',
  email: 'a@example.com',
  unsubscribeUrl: 'https://app.test/unsub?token=x',
};

describe('staleReminderTemplate', () => {
  it('lists each stale job with a deep link to its status picker', () => {
    const html = staleReminderTemplate({
      ...base,
      jobs: [
        { applicationId: 'app-1', company: 'Acme', role: 'SRE', status: 'Applied', daysSinceUpdate: 7 },
      ],
    });
    expect(html).toContain('Acme');
    expect(html).toContain('SRE');
    expect(html).toContain('/dashboard/application/app-1?focus=status');
    expect(html).toContain(base.unsubscribeUrl);
    expect(html).toContain('Ada');
  });

  it('uses a plural lead for multiple stale jobs', () => {
    const html = staleReminderTemplate({
      ...base,
      jobs: [
        { applicationId: 'a', company: 'Acme', role: 'SRE', status: 'Applied', daysSinceUpdate: 6 },
        { applicationId: 'b', company: 'Globex', role: 'Dev', status: 'Interviewed', daysSinceUpdate: 9 },
      ],
    });
    expect(html).toContain('2 applications');
  });
});

describe('weeklyDigestTemplate', () => {
  it('renders the three pipeline stats and the AI insight', () => {
    const html = weeklyDigestTemplate({
      ...base,
      activeCount: 5,
      needsFollowUp: 2,
      newThisWeek: 1,
      insight: 'Consider adding a few startup applications.',
    });
    expect(html).toContain('5');
    expect(html).toContain('need follow-up');
    expect(html).toContain('AI Coach');
    expect(html).toContain('Consider adding a few startup applications.');
  });

  it('omits the insight block when none is provided', () => {
    const html = weeklyDigestTemplate({
      ...base,
      activeCount: 1,
      needsFollowUp: 0,
      newThisWeek: 0,
    });
    expect(html).not.toContain('AI Coach:');
  });
});
