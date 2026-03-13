import { sanitizeFilename, sanitizeFilenameWithTimestamp } from '../sanitize-filename';

describe('sanitizeFilename', () => {
  it('should remove accents and diacritics', () => {
    expect(sanitizeFilename('résumé.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('café.txt')).toBe('cafe.txt');
    expect(sanitizeFilename('naïve.docx')).toBe('naive.docx');
  });

  it('should handle various Unicode characters', () => {
    expect(sanitizeFilename('João_García.pdf')).toBe('Joao_Garcia.pdf');
    expect(sanitizeFilename('Müller_résumé.doc')).toBe('Muller_resume.doc');
    expect(sanitizeFilename('Søren_Ørsted.txt')).toBe('Sren_rsted.txt');
  });

  it('should replace spaces with underscores', () => {
    expect(sanitizeFilename('my resume.pdf')).toBe('my_resume.pdf');
    expect(sanitizeFilename('cover  letter.docx')).toBe('cover_letter.docx');
  });

  it('should remove special characters', () => {
    expect(sanitizeFilename("John's résumé!.pdf")).toBe('Johns_resume.pdf');
    expect(sanitizeFilename('résumé@2024#.doc')).toBe('resume2024.doc');
    expect(sanitizeFilename('file (1).txt')).toBe('file_1.txt');
  });

  it('should collapse consecutive underscores and hyphens', () => {
    expect(sanitizeFilename('my___file.pdf')).toBe('my_file.pdf');
    expect(sanitizeFilename('my---file.txt')).toBe('my-file.txt');
    expect(sanitizeFilename('my__--__file.doc')).toBe('my_file.doc');
  });

  it('should trim leading and trailing underscores/hyphens', () => {
    expect(sanitizeFilename('_resume_.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('--file--.txt')).toBe('file.txt');
    expect(sanitizeFilename('___test___.docx')).toBe('test.docx');
  });

  it('should preserve file extensions', () => {
    expect(sanitizeFilename('résumé.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('file.docx')).toBe('file.docx');
    // Note: Multiple dots in filename are treated as part of the name, only the last dot is the extension
    expect(sanitizeFilename('data.tar.gz')).toBe('datatar.gz');
    expect(sanitizeFilename('my.file.name.pdf')).toBe('myfilename.pdf');
  });

  it('should handle filenames without extensions', () => {
    expect(sanitizeFilename('résumé')).toBe('resume');
    expect(sanitizeFilename('my file')).toBe('my_file');
  });

  it('should handle edge cases', () => {
    expect(sanitizeFilename('')).toBe('');
    expect(sanitizeFilename('.pdf')).toBe('file.pdf');
    expect(sanitizeFilename('...')).toBe('file.');
    expect(sanitizeFilename('###.pdf')).toBe('file.pdf');
  });

  it('should preserve alphanumeric characters and hyphens', () => {
    expect(sanitizeFilename('resume-2024.pdf')).toBe('resume-2024.pdf');
    expect(sanitizeFilename('john_doe_cv.docx')).toBe('john_doe_cv.docx');
    expect(sanitizeFilename('file123.txt')).toBe('file123.txt');
  });

  it('should handle real-world examples', () => {
    expect(sanitizeFilename('José García Resume 2024.pdf'))
      .toBe('Jose_Garcia_Resume_2024.pdf');
    expect(sanitizeFilename('François Müller - CV (final).docx'))
      .toBe('Francois_Muller_CV_final.docx');
    expect(sanitizeFilename("Søren's résumé v2.1.pdf"))
      .toBe('Srens_resume_v21.pdf');
  });
});

describe('sanitizeFilenameWithTimestamp', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1710345678901);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should add timestamp to sanitized filename', () => {
    expect(sanitizeFilenameWithTimestamp('résumé.pdf'))
      .toBe('resume_1710345678901.pdf');
  });

  it('should add userId and timestamp when provided', () => {
    expect(sanitizeFilenameWithTimestamp('résumé.pdf', 'user123'))
      .toBe('user123_resume_1710345678901.pdf');
  });

  it('should sanitize filename before adding timestamp', () => {
    expect(sanitizeFilenameWithTimestamp('José García.pdf', 'user456'))
      .toBe('user456_Jose_Garcia_1710345678901.pdf');
  });

  it('should handle filenames without extensions', () => {
    expect(sanitizeFilenameWithTimestamp('résumé', 'user789'))
      .toBe('user789_resume_1710345678901');
  });
});
