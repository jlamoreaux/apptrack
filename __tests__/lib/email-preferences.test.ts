import {
  isCategoryEnabledFor,
  DEFAULT_EMAIL_PREFERENCES,
  type EmailPreferences,
} from '@/lib/email/preferences';

describe('isCategoryEnabledFor', () => {
  it('defaults to enabled when there is no preferences row', () => {
    expect(isCategoryEnabledFor(null, 'drip')).toBe(true);
    expect(isCategoryEnabledFor(null, 'reminders')).toBe(true);
    expect(isCategoryEnabledFor(null, 'digest')).toBe(true);
  });

  it('respects the master unsubscribe switch', () => {
    const prefs: EmailPreferences = { ...DEFAULT_EMAIL_PREFERENCES, unsubscribed_all: true };
    expect(isCategoryEnabledFor(prefs, 'drip')).toBe(false);
    expect(isCategoryEnabledFor(prefs, 'reminders')).toBe(false);
    expect(isCategoryEnabledFor(prefs, 'digest')).toBe(false);
  });

  it('honors individual category flags', () => {
    const prefs: EmailPreferences = {
      ...DEFAULT_EMAIL_PREFERENCES,
      reminders_enabled: false,
    };
    expect(isCategoryEnabledFor(prefs, 'reminders')).toBe(false);
    expect(isCategoryEnabledFor(prefs, 'drip')).toBe(true);
    expect(isCategoryEnabledFor(prefs, 'digest')).toBe(true);
  });
});
