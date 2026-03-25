import { sanitizeTextForDb } from '../text-extraction-server';

describe('sanitizeTextForDb', () => {
  it('should remove null bytes', () => {
    expect(sanitizeTextForDb('hello\u0000world')).toBe('helloworld');
    expect(sanitizeTextForDb('\u0000\u0000\u0000')).toBe('');
  });

  it('should remove C0 control characters except tab, newline, carriage return', () => {
    // SOH, STX, ETX, EOT, ENQ, ACK, BEL, BS
    expect(sanitizeTextForDb('a\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008b')).toBe('ab');
    // VT, FF
    expect(sanitizeTextForDb('a\u000B\u000Cb')).toBe('ab');
    // SO through US
    expect(sanitizeTextForDb('a\u000E\u000F\u0010\u001F b')).toBe('a b');
  });

  it('should preserve tab, newline, and carriage return', () => {
    expect(sanitizeTextForDb('line1\nline2')).toBe('line1\nline2');
    expect(sanitizeTextForDb('col1\tcol2')).toBe('col1\tcol2');
    expect(sanitizeTextForDb('line1\r\nline2')).toBe('line1\r\nline2');
  });

  it('should remove C1 control characters (U+007F-U+009F)', () => {
    expect(sanitizeTextForDb('a\u007Fb')).toBe('ab'); // DEL
    expect(sanitizeTextForDb('a\u0080\u008F\u009Fb')).toBe('ab');
  });

  it('should preserve normal ASCII text', () => {
    const text = 'Software Engineer with 5+ years of experience. Skills: Python, TypeScript, SQL.';
    expect(sanitizeTextForDb(text)).toBe(text);
  });

  it('should preserve valid Unicode characters (accents, CJK, emoji)', () => {
    expect(sanitizeTextForDb('résumé')).toBe('résumé');
    expect(sanitizeTextForDb('日本語テキスト')).toBe('日本語テキスト');
    expect(sanitizeTextForDb('Ørsted & García')).toBe('Ørsted & García');
  });

  it('should handle empty string', () => {
    expect(sanitizeTextForDb('')).toBe('');
  });

  it('should handle text with mixed valid and invalid characters', () => {
    expect(sanitizeTextForDb('Name:\tJohn\u0000 Doe\nTitle: Engineer\u0003'))
      .toBe('Name:\tJohn Doe\nTitle: Engineer');
  });
});
