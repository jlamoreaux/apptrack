/**
 * Real-world examples of filename sanitization
 * 
 * This test file demonstrates how the sanitization utility handles
 * various problematic filenames that users might upload.
 */

import { sanitizeFilename } from '../sanitize-filename';

describe('Real-World Filename Sanitization Examples', () => {
  it('should handle international names with accents', () => {
    // French names
    expect(sanitizeFilename('François_Résumé.pdf')).toBe('Francois_Resume.pdf');
    expect(sanitizeFilename('Amélie_CV_été_2024.docx')).toBe('Amelie_CV_ete_2024.docx');
    
    // Spanish names
    expect(sanitizeFilename('José_García_Currículum.pdf')).toBe('Jose_Garcia_Curriculum.pdf');
    
    // Portuguese names
    expect(sanitizeFilename('João_Gonçalves_Resume.pdf')).toBe('Joao_Goncalves_Resume.pdf');
    
    // German names (Note: Turkish ğ becomes Og after normalization)
    expect(sanitizeFilename('Müller_Öğretmen_CV.pdf')).toBe('Muller_Ogretmen_CV.pdf');
    
    // Scandinavian names
    expect(sanitizeFilename('Søren_Ørsted_Resume.pdf')).toBe('Sren_rsted_Resume.pdf');
  });

  it('should handle files with possessive apostrophes', () => {
    expect(sanitizeFilename("John's Resume.pdf")).toBe('Johns_Resume.pdf');
    expect(sanitizeFilename("O'Brien CV.docx")).toBe('OBrien_CV.docx');
    expect(sanitizeFilename("Sarah's Cover Letter.pdf")).toBe('Sarahs_Cover_Letter.pdf');
  });

  it('should handle files with parentheses and version numbers', () => {
    expect(sanitizeFilename('Resume (final).pdf')).toBe('Resume_final.pdf');
    expect(sanitizeFilename('CV (version 2).docx')).toBe('CV_version_2.docx');
    expect(sanitizeFilename('Resume (FINAL FINAL).pdf')).toBe('Resume_FINAL_FINAL.pdf');
  });

  it('should handle files with special formatting characters', () => {
    expect(sanitizeFilename('Resume - Updated 2024.pdf')).toBe('Resume_Updated_2024.pdf');
    expect(sanitizeFilename('CV | John Doe.pdf')).toBe('CV_John_Doe.pdf');
    expect(sanitizeFilename('Resume & Portfolio.pdf')).toBe('Resume_Portfolio.pdf');
    expect(sanitizeFilename('CV @ Company.pdf')).toBe('CV_Company.pdf');
  });

  it('should handle files with excessive spacing', () => {
    expect(sanitizeFilename('my    resume.pdf')).toBe('my_resume.pdf');
    expect(sanitizeFilename('John  Doe  CV.pdf')).toBe('John_Doe_CV.pdf');
  });

  it('should handle files with mixed case and special characters', () => {
    expect(sanitizeFilename('JohnDoe_RESUME!!!.pdf')).toBe('JohnDoe_RESUME.pdf');
    expect(sanitizeFilename('FINAL-CV@2024#v3.docx')).toBe('FINAL-CV2024v3.docx');
  });

  it('should handle files exported from different systems', () => {
    // Windows file names
    expect(sanitizeFilename('Resume (1).pdf')).toBe('Resume_1.pdf');
    
    // Mac file names
    expect(sanitizeFilename('Resume copy.pdf')).toBe('Resume_copy.pdf');
    
    // Google Drive export
    expect(sanitizeFilename('Resume - Google Docs.pdf')).toBe('Resume_Google_Docs.pdf');
  });

  it('should handle edge cases that might break storage systems', () => {
    // Very long consecutive special characters
    expect(sanitizeFilename('resume!!!!!!.pdf')).toBe('resume.pdf');
    
    // Mixed special characters (trailing underscore is trimmed)
    expect(sanitizeFilename('résumé_@#$%^&*().pdf')).toBe('resume.pdf');
    
    // Leading/trailing problematic characters
    expect(sanitizeFilename('___resume___.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('---CV---.pdf')).toBe('CV.pdf');
  });

  it('should preserve meaningful hyphens and underscores', () => {
    expect(sanitizeFilename('John-Doe_Resume_2024.pdf')).toBe('John-Doe_Resume_2024.pdf');
    expect(sanitizeFilename('senior-software-engineer.pdf')).toBe('senior-software-engineer.pdf');
  });

  it('should handle unicode emoji and symbols', () => {
    // Emojis are removed, and trailing underscores are trimmed
    expect(sanitizeFilename('Resume 🚀.pdf')).toBe('Resume.pdf');
    expect(sanitizeFilename('CV ✨ 2024.pdf')).toBe('CV_2024.pdf');
    expect(sanitizeFilename('Portfolio™.pdf')).toBe('Portfolio.pdf');
  });
});

describe('Sanitization Transformation Examples', () => {
  const examples: Array<{ original: string; sanitized: string; description: string }> = [
    {
      original: 'résumé.pdf',
      sanitized: 'resume.pdf',
      description: 'Basic accent removal',
    },
    {
      original: 'José García Resume.pdf',
      sanitized: 'Jose_Garcia_Resume.pdf',
      description: 'Multiple accents and spaces',
    },
    {
      original: "John's Resume (final)!!!.pdf",
      sanitized: 'Johns_Resume_final.pdf',
      description: 'Apostrophe, parentheses, and exclamation marks',
    },
    {
      original: 'François Müller - CV @2024.docx',
      sanitized: 'Francois_Muller_CV_2024.docx',
      description: 'Complex international characters and symbols',
    },
    {
      original: '___my___resume___.pdf',
      sanitized: 'my_resume.pdf',
      description: 'Excessive underscores trimmed and collapsed',
    },
  ];

  examples.forEach(({ original, sanitized, description }) => {
    it(`should transform "${original}" → "${sanitized}" (${description})`, () => {
      expect(sanitizeFilename(original)).toBe(sanitized);
    });
  });
});
