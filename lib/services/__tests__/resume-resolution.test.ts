/**
 * ResumeResolutionService Test Suite
 *
 * Covers the three-priority resolution chain and validation behaviour.
 * External calls to AIDataFetcherService are mocked — no DB or network needed.
 */

import { ResumeResolutionService } from '../resume-resolution.service';
import { AIDataFetcherService } from '../ai-data-fetcher.service';

jest.mock('../ai-data-fetcher.service');

const mockGetUserResumeById = AIDataFetcherService.getUserResumeById as jest.Mock;
const mockGetUserResume = AIDataFetcherService.getUserResume as jest.Mock;

const VALID_TEXT = 'John Doe\nSoftware Engineer\n5 years experience in TypeScript and React.';
const OVERSIZED_TEXT = 'x'.repeat(100_001);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Priority 1 — provided resumeText
// ---------------------------------------------------------------------------

describe('Priority 1: provided resumeText', () => {
  it('returns the provided text immediately without hitting the DB', async () => {
    const result = await ResumeResolutionService.resolveResume('user-1', {
      resumeText: VALID_TEXT,
    });

    expect(result.text).toBe(VALID_TEXT);
    expect(result.source).toBe('provided');
    expect(result.id).toBeNull();
    expect(mockGetUserResumeById).not.toHaveBeenCalled();
    expect(mockGetUserResume).not.toHaveBeenCalled();
  });

  it('includes resumeId in result when both are supplied', async () => {
    const result = await ResumeResolutionService.resolveResume('user-1', {
      resumeText: VALID_TEXT,
      resumeId: 'resume-abc',
    });

    expect(result.id).toBe('resume-abc');
    expect(result.source).toBe('provided');
  });

  it('throws for whitespace-only resumeText', async () => {
    await expect(
      ResumeResolutionService.resolveResume('user-1', { resumeText: '   ' })
    ).rejects.toThrow('Resume text is empty or invalid');
  });

  it('throws when resumeText exceeds 100,000 characters', async () => {
    await expect(
      ResumeResolutionService.resolveResume('user-1', { resumeText: OVERSIZED_TEXT })
    ).rejects.toThrow('Resume text exceeds maximum length');
  });
});

// ---------------------------------------------------------------------------
// Priority 2 — fetch by resumeId
// ---------------------------------------------------------------------------

describe('Priority 2: fetch by resumeId', () => {
  it('fetches and returns resume by ID', async () => {
    mockGetUserResumeById.mockResolvedValue({ text: VALID_TEXT, id: 'resume-xyz' });

    const result = await ResumeResolutionService.resolveResume('user-1', {
      resumeId: 'resume-xyz',
    });

    expect(result.text).toBe(VALID_TEXT);
    expect(result.id).toBe('resume-xyz');
    expect(result.source).toBe('specified');
    expect(mockGetUserResumeById).toHaveBeenCalledWith('user-1', 'resume-xyz');
    expect(mockGetUserResume).not.toHaveBeenCalled();
  });

  it('throws when resume by ID exists but has no text', async () => {
    mockGetUserResumeById.mockResolvedValue({ text: null, id: 'resume-xyz' });

    await expect(
      ResumeResolutionService.resolveResume('user-1', { resumeId: 'resume-xyz' })
    ).rejects.toThrow('Resume not found or has no content');
  });

  it('throws when getUserResumeById returns null', async () => {
    mockGetUserResumeById.mockResolvedValue(null);

    await expect(
      ResumeResolutionService.resolveResume('user-1', { resumeId: 'resume-xyz' })
    ).rejects.toThrow('Resume not found or has no content');
  });

  it('throws when resume by ID contains only whitespace', async () => {
    mockGetUserResumeById.mockResolvedValue({ text: '   \n  ', id: 'resume-xyz' });

    await expect(
      ResumeResolutionService.resolveResume('user-1', { resumeId: 'resume-xyz' })
    ).rejects.toThrow('Resume text is empty or invalid');
  });
});

// ---------------------------------------------------------------------------
// Priority 3 — default resume fallback
// ---------------------------------------------------------------------------

describe('Priority 3: default resume fallback', () => {
  it('falls back to the default resume when no text or ID is provided', async () => {
    mockGetUserResume.mockResolvedValue({ text: VALID_TEXT, id: 'resume-default' });

    const result = await ResumeResolutionService.resolveResume('user-1', {});

    expect(result.text).toBe(VALID_TEXT);
    expect(result.id).toBe('resume-default');
    expect(result.source).toBe('default');
    expect(mockGetUserResume).toHaveBeenCalledWith('user-1');
  });

  it('throws when no default resume exists', async () => {
    mockGetUserResume.mockResolvedValue({ text: null, id: null });

    await expect(
      ResumeResolutionService.resolveResume('user-1', {})
    ).rejects.toThrow('No resume found. Please upload your resume first.');
  });

  it('throws when getUserResume returns null', async () => {
    mockGetUserResume.mockResolvedValue(null);

    await expect(
      ResumeResolutionService.resolveResume('user-1', {})
    ).rejects.toThrow('No resume found. Please upload your resume first.');
  });

  it('throws when default resume text is whitespace-only', async () => {
    mockGetUserResume.mockResolvedValue({ text: '\t\n  ', id: 'resume-default' });

    await expect(
      ResumeResolutionService.resolveResume('user-1', {})
    ).rejects.toThrow('Resume text is empty or invalid');
  });

  it('id is null when default resume has no ID', async () => {
    mockGetUserResume.mockResolvedValue({ text: VALID_TEXT, id: null });

    const result = await ResumeResolutionService.resolveResume('user-1', {});

    expect(result.id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateResumeText (public utility)
// ---------------------------------------------------------------------------

describe('validateResumeText', () => {
  it('passes for normal resume text', () => {
    expect(() => ResumeResolutionService.validateResumeText(VALID_TEXT)).not.toThrow();
  });

  it('throws for empty string', () => {
    expect(() => ResumeResolutionService.validateResumeText('')).toThrow('empty or invalid');
  });

  it('throws for whitespace-only string', () => {
    expect(() => ResumeResolutionService.validateResumeText('   ')).toThrow('empty or invalid');
  });

  it('throws when text exceeds 100,000 characters', () => {
    expect(() => ResumeResolutionService.validateResumeText(OVERSIZED_TEXT)).toThrow('exceeds maximum length');
  });

  it('passes for text exactly at the 100,000 character limit', () => {
    expect(() =>
      ResumeResolutionService.validateResumeText('x'.repeat(100_000))
    ).not.toThrow();
  });
});
