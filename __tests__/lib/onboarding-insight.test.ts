import {
  clampSentences,
  buildInsightPrompt,
} from '@/lib/ai-coach/onboarding-insight';

describe('clampSentences', () => {
  it('returns text unchanged when within the limit', () => {
    const text = 'One sentence. Two sentences.';
    expect(clampSentences(text, 4)).toBe(text);
  });

  it('trims to the requested number of sentences', () => {
    const text = 'A. B. C. D. E.';
    const result = clampSentences(text, 3);
    expect(result).toBe('A. B. C.');
  });

  it('supports a single-sentence clamp for digest insights', () => {
    const text = 'First insight here. Second one. Third one.';
    expect(clampSentences(text, 1)).toBe('First insight here.');
  });
});

describe('buildInsightPrompt', () => {
  it('includes company and role', () => {
    const prompt = buildInsightPrompt({ company: 'Acme', role: 'SRE' });
    expect(prompt).toContain('Acme');
    expect(prompt).toContain('SRE');
  });

  it('appends the job description when provided', () => {
    const prompt = buildInsightPrompt({
      company: 'Acme',
      role: 'SRE',
      jobDescription: 'Kubernetes and Terraform experience required.',
    });
    expect(prompt).toContain('Kubernetes and Terraform');
  });
});
