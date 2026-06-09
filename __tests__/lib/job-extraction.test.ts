import {
  htmlToText,
  parseExtractionResponse,
  isBlockedHost,
} from '@/lib/onboarding/job-extraction';

describe('isBlockedHost', () => {
  it('blocks loopback, private, and link-local hosts', () => {
    expect(isBlockedHost('localhost')).toBe(true);
    expect(isBlockedHost('127.0.0.1')).toBe(true);
    expect(isBlockedHost('10.0.0.5')).toBe(true);
    expect(isBlockedHost('192.168.1.1')).toBe(true);
    expect(isBlockedHost('172.16.0.1')).toBe(true);
    expect(isBlockedHost('169.254.169.254')).toBe(true); // cloud metadata
    expect(isBlockedHost('::1')).toBe(true);
  });

  it('allows normal public job-board hosts', () => {
    expect(isBlockedHost('www.linkedin.com')).toBe(false);
    expect(isBlockedHost('boards.greenhouse.io')).toBe(false);
    expect(isBlockedHost('172.15.0.1')).toBe(false); // just outside private range
  });
});

describe('htmlToText', () => {
  it('strips script, style, and tags into readable text', () => {
    const html =
      '<html><head><style>.a{color:red}</style><script>alert(1)</script></head>' +
      '<body><h1>Senior Engineer</h1><p>Build&nbsp;things</p></body></html>';
    const text = htmlToText(html);
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('Build things');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });
});

describe('parseExtractionResponse', () => {
  const url = 'https://example.com/jobs/123';

  it('parses a clean JSON object', () => {
    const raw = JSON.stringify({
      company: 'Acme',
      title: 'Staff Engineer',
      location: 'Remote',
      description_summary: 'Build the platform.',
    });
    const job = parseExtractionResponse(raw, url);
    expect(job).toEqual({
      company: 'Acme',
      title: 'Staff Engineer',
      location: 'Remote',
      posting_url: url,
      description_summary: 'Build the platform.',
    });
  });

  it('tolerates code fences and surrounding prose', () => {
    const raw = 'Here you go:\n```json\n{"company":"Acme","title":"Dev"}\n```';
    const job = parseExtractionResponse(raw, url);
    expect(job.company).toBe('Acme');
    expect(job.title).toBe('Dev');
    expect(job.location).toBeNull();
    expect(job.posting_url).toBe(url);
  });

  it('coerces sentinel strings to null', () => {
    const raw = '{"company":"Unknown","title":"N/A","location":"not specified"}';
    const job = parseExtractionResponse(raw, url);
    expect(job.company).toBeNull();
    expect(job.title).toBeNull();
    expect(job.location).toBeNull();
  });

  it('falls back to nulls on unparseable input', () => {
    const job = parseExtractionResponse('not json at all', url);
    expect(job).toEqual({
      company: null,
      title: null,
      location: null,
      posting_url: url,
      description_summary: null,
    });
  });
});
