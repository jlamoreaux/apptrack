/**
 * Tests for lib/utils/text-extraction.ts
 * File-type label and supported-type utilities
 */

// @jest-environment node

import {
  getFileTypeLabel,
  isSupportedFileType,
} from '@/lib/utils/text-extraction';

// ---------------------------------------------------------------------------
// getFileTypeLabel
// ---------------------------------------------------------------------------
describe('getFileTypeLabel', () => {
  it('returns "PDF" for application/pdf', () => {
    expect(getFileTypeLabel('application/pdf')).toBe('PDF');
  });

  it('returns "DOC" for application/msword', () => {
    expect(getFileTypeLabel('application/msword')).toBe('DOC');
  });

  it('returns "DOCX" for the Open XML Word document MIME type', () => {
    expect(
      getFileTypeLabel(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe('DOCX');
  });

  it('returns "TXT" for text/plain', () => {
    expect(getFileTypeLabel('text/plain')).toBe('TXT');
  });

  it('returns "Unknown" for an unrecognised MIME type', () => {
    expect(getFileTypeLabel('image/jpeg')).toBe('Unknown');
  });

  it('returns "Unknown" for an empty string', () => {
    expect(getFileTypeLabel('')).toBe('Unknown');
  });

  it('returns "Unknown" for a completely arbitrary string', () => {
    expect(getFileTypeLabel('application/octet-stream')).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// isSupportedFileType
// ---------------------------------------------------------------------------
describe('isSupportedFileType', () => {
  it('returns true for application/pdf', () => {
    expect(isSupportedFileType('application/pdf')).toBe(true);
  });

  it('returns true for application/msword', () => {
    expect(isSupportedFileType('application/msword')).toBe(true);
  });

  it('returns true for the Open XML Word document MIME type', () => {
    expect(
      isSupportedFileType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(true);
  });

  it('returns true for text/plain', () => {
    expect(isSupportedFileType('text/plain')).toBe(true);
  });

  it('returns false for image/jpeg', () => {
    expect(isSupportedFileType('image/jpeg')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isSupportedFileType('')).toBe(false);
  });

  it('returns false for application/octet-stream', () => {
    expect(isSupportedFileType('application/octet-stream')).toBe(false);
  });

  it('returns false for text/html', () => {
    expect(isSupportedFileType('text/html')).toBe(false);
  });
});
