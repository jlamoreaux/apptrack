/**
 * Tests for analysis export utility functions
 * Tests clipboard copying and PDF download functionality
 */

import {
  formatAnalysisForExport,
  formatAnalysisForRichText,
  copyAnalysisToClipboard,
  downloadAnalysisPDF,
  isClipboardSupported
} from '@/lib/utils/analysis-export';
import type { JobFitAnalysisResult } from '@/types/ai-analysis';

// Mock the global objects
const mockClipboard = {
  writeText: jest.fn(),
  write: jest.fn()
};

const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

// Mock document methods
const mockDocumentMethods = {
  createElement: jest.fn(),
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  queryCommandSupported: jest.fn()
};

// Sample analysis data for testing
const mockAnalysis: JobFitAnalysisResult = {
  overallScore: 85,
  scoreLabel: 'Excellent Match',
  strengths: [
    'Strong experience with React and modern JavaScript',
    'Proven track record in full-stack development',
    'Excellent problem-solving skills'
  ],
  weaknesses: [
    'Limited experience with TypeScript',
    'Could benefit from more cloud platform knowledge'
  ],
  recommendations: [
    'Consider taking a TypeScript course',
    'Explore AWS or Google Cloud certifications',
    'Practice system design concepts'
  ],
  keyRequirements: [
    'React',
    'Node.js',
    'TypeScript',
    'AWS',
    'System Design'
  ],
  matchDetails: {
    skillsMatch: 90,
    experienceMatch: 85,
    educationMatch: 75
  },
  generatedAt: '2024-01-15T10:30:00.000Z'
};

describe('Analysis Export Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ClipboardItem
    global.ClipboardItem = jest.fn().mockImplementation((data) => ({ data }));
    
    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true
    });
    
    // Mock URL methods
    Object.defineProperty(global, 'URL', {
      value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      },
      writable: true,
      configurable: true
    });
    
    // Mock document methods
    const mockElement = {
      href: '',
      download: '',
      click: jest.fn(),
      style: {},
      value: '',
      focus: jest.fn(),
      select: jest.fn(),
      remove: jest.fn()
    };
    
    mockDocumentMethods.createElement.mockReturnValue(mockElement);
    
    Object.defineProperty(document, 'createElement', {
      value: mockDocumentMethods.createElement,
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(document.body, 'appendChild', {
      value: mockDocumentMethods.appendChild,
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(document.body, 'removeChild', {
      value: mockDocumentMethods.removeChild,
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(document, 'queryCommandSupported', {
      value: mockDocumentMethods.queryCommandSupported,
      writable: true,
      configurable: true
    });
    
    // Mock execCommand
    Object.defineProperty(document, 'execCommand', {
      value: jest.fn().mockReturnValue(true),
      writable: true,
      configurable: true
    });
  });


  describe('formatAnalysisForExport', () => {
    it('should format analysis data into human-readable text', () => {
      const result = formatAnalysisForExport(mockAnalysis);
      
      expect(result).toContain('JOB FIT ANALYSIS REPORT');
      expect(result).toContain('OVERALL SCORE: 85% - Excellent Match');
      expect(result).toContain('Skills Match: 90%');
      expect(result).toContain('Experience Match: 85%');
      expect(result).toContain('Education Match: 75%');
      expect(result).toContain('Strong experience with React');
      expect(result).toContain('Limited experience with TypeScript');
      expect(result).toContain('Consider taking a TypeScript course');
      expect(result).toContain('React');
      expect(result).toContain('January 15, 2024');
    });

    it('should handle missing or empty data gracefully', () => {
      const incompleteAnalysis: JobFitAnalysisResult = {
        overallScore: 75,
        scoreLabel: 'Good Match',
        strengths: [],
        weaknesses: undefined as any,
        recommendations: undefined as any,
        keyRequirements: undefined as any,
        matchDetails: {
          skillsMatch: 80,
          experienceMatch: 70,
          educationMatch: 65
        },
        generatedAt: '2024-01-15T10:30:00.000Z'
      };
      
      const result = formatAnalysisForExport(incompleteAnalysis);
      
      expect(result).toContain('OVERALL SCORE: 75% - Good Match');
      expect(result).toContain('No strengths data available');
      expect(result).toContain('No areas for improvement data available');
      expect(result).toContain('No recommendations data available');
      expect(result).toContain('No key requirements data available');
    });
  });

  describe('formatAnalysisForRichText', () => {
    it('should format analysis data into styled HTML', () => {
      const result = formatAnalysisForRichText(mockAnalysis);
      
      expect(result).toContain('<div style=');
      expect(result).toContain('Job Fit Analysis Report');
      expect(result).toContain('85%');
      expect(result).toContain('Excellent Match');
      expect(result).toContain('Skills Match');
      expect(result).toContain('90%');
      expect(result).toContain('Strong experience with React');
      expect(result).toContain('Limited experience with TypeScript');
      expect(result).toContain('Consider taking a TypeScript course');
      expect(result).toContain('Your Strengths');
      expect(result).toContain('Areas to Address');
      expect(result).toContain('Key Requirements');
      expect(result).toContain('Recommendations');
      expect(result).toContain('AppTrack AI Coach');
    });

    it('should handle missing data gracefully in HTML format', () => {
      const incompleteAnalysis: JobFitAnalysisResult = {
        overallScore: 75,
        scoreLabel: 'Good Match',
        strengths: [],
        weaknesses: undefined as any,
        recommendations: undefined as any,
        keyRequirements: undefined as any,
        matchDetails: {
          skillsMatch: 80,
          experienceMatch: 70,
          educationMatch: 65
        },
        generatedAt: '2024-01-15T10:30:00.000Z'
      };
      
      const result = formatAnalysisForRichText(incompleteAnalysis);
      
      expect(result).toContain('75%');
      expect(result).toContain('Good Match');
      expect(result).toContain('No strengths data available');
      expect(result).toContain('No areas for improvement data available');
      expect(result).toContain('No recommendations data available');
      expect(result).toContain('No key requirements data available');
    });
  });

  describe('copyAnalysisToClipboard', () => {
    it('should copy rich text format when clipboard.write is supported', async () => {
      mockClipboard.write.mockResolvedValue(undefined);
      
      await copyAnalysisToClipboard(mockAnalysis);
      
      expect(mockClipboard.write).toHaveBeenCalledTimes(1);
      expect(global.ClipboardItem).toHaveBeenCalledWith({
        'text/html': expect.any(Blob),
        'text/plain': expect.any(Blob)
      });
    });

    it('should fallback to plain text when rich text fails', async () => {
      mockClipboard.write.mockRejectedValue(new Error('Rich text not supported'));
      mockClipboard.writeText.mockResolvedValue(undefined);
      
      await copyAnalysisToClipboard(mockAnalysis);
      
      expect(mockClipboard.write).toHaveBeenCalledTimes(1);
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
      const copiedText = mockClipboard.writeText.mock.calls[0][0];
      expect(copiedText).toContain('JOB FIT ANALYSIS REPORT');
      expect(copiedText).toContain('OVERALL SCORE: 85%');
    });

    it('should copy formatted analysis to clipboard using writeText when write not available', async () => {
      // Remove write method to test fallback
      const clipboardWithoutWrite = { writeText: jest.fn().mockResolvedValue(undefined) };
      Object.defineProperty(navigator, 'clipboard', {
        value: clipboardWithoutWrite,
        writable: true,
        configurable: true
      });
      
      await copyAnalysisToClipboard(mockAnalysis);
      
      expect(clipboardWithoutWrite.writeText).toHaveBeenCalledTimes(1);
      const copiedText = clipboardWithoutWrite.writeText.mock.calls[0][0];
      expect(copiedText).toContain('JOB FIT ANALYSIS REPORT');
      expect(copiedText).toContain('OVERALL SCORE: 85%');
    });

    it('should handle clipboard API failure and use fallback method', async () => {
      // Remove clipboard API to test fallback
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      // Mock execCommand to return true (success)
      Object.defineProperty(document, 'execCommand', {
        value: jest.fn().mockReturnValue(true),
        writable: true,
        configurable: true
      });
      
      await copyAnalysisToClipboard(mockAnalysis);
      
      expect(mockDocumentMethods.createElement).toHaveBeenCalledWith('textarea');
      expect(mockDocumentMethods.appendChild).toHaveBeenCalled();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(mockDocumentMethods.removeChild).toHaveBeenCalled();
    });

    it('should throw error when both clipboard API and fallback fail', async () => {
      // Remove write method and make writeText fail
      const failingClipboard = { writeText: jest.fn().mockRejectedValue(new Error('Clipboard API failed')) };
      Object.defineProperty(navigator, 'clipboard', {
        value: failingClipboard,
        writable: true,
        configurable: true
      });
      
      await expect(copyAnalysisToClipboard(mockAnalysis)).rejects.toThrow('Clipboard API failed');
    });

    it('should throw error when fallback execCommand fails', async () => {
      // Remove clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      // Mock execCommand to return false (failure)
      Object.defineProperty(document, 'execCommand', {
        value: jest.fn().mockReturnValue(false),
        writable: true,
        configurable: true
      });
      
      await expect(copyAnalysisToClipboard(mockAnalysis)).rejects.toThrow('Failed to copy to clipboard');
      
      // Verify cleanup still happens
      expect(mockDocumentMethods.removeChild).toHaveBeenCalled();
    });
  });

  describe('downloadAnalysisPDF', () => {
    it('should create and download a print-optimized HTML file', async () => {
      const mockBlob = { type: 'text/html' };
      const mockBlobURL = 'blob:http://localhost/test-url';
      
      global.Blob = jest.fn().mockImplementation((content, options) => ({
        ...mockBlob,
        content,
        options
      })) as any;
      
      mockCreateObjectURL.mockReturnValue(mockBlobURL);
      
      const applicationInfo = {
        company: 'Tech Corp',
        role: 'Software Engineer'
      };
      
      await downloadAnalysisPDF(mockAnalysis, applicationInfo);
      
      // Verify blob creation with print-optimized HTML
      expect(global.Blob).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('print-instructions')]),
        { type: 'text/html; charset=utf-8' }
      );
      
      // Verify blob URL creation
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      
      // Verify download link creation and triggering
      expect(mockDocumentMethods.createElement).toHaveBeenCalledWith('a');
      expect(mockDocumentMethods.appendChild).toHaveBeenCalled();
    });

    it('should generate proper filename with company and role info', async () => {
      const mockElement = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
        value: '',
        focus: jest.fn(),
        select: jest.fn(),
        remove: jest.fn()
      };
      
      mockDocumentMethods.createElement.mockReturnValue(mockElement);
      
      await downloadAnalysisPDF(mockAnalysis, {
        company: 'Tech Corp Inc',
        role: 'Senior Software Engineer'
      });
      
      expect(mockElement.download).toBe(
        'job-fit-analysis-tech-corp-inc-senior-software-engineer.html'
      );
    });

    it('should include print instructions and analysis data in HTML content', async () => {
      global.Blob = jest.fn().mockImplementation((content, options) => ({
        content,
        options,
        type: 'text/html'
      })) as any;
      
      await downloadAnalysisPDF(mockAnalysis, {
        company: 'Tech Corp',
        role: 'Software Engineer'
      });
      
      const blobContent = (global.Blob as jest.Mock).mock.calls[0][0][0];
      
      // Verify it contains print instructions
      expect(blobContent).toContain('To save as PDF: Press Ctrl+P');
      
      // Verify it contains analysis data
      expect(blobContent).toContain('85%');
      expect(blobContent).toContain('Excellent Match');
      expect(blobContent).toContain('Strong experience with React');
      expect(blobContent).toContain('Limited experience with TypeScript');
      expect(blobContent).toContain('Tech Corp');
      expect(blobContent).toContain('Software Engineer');
      expect(blobContent).toContain('Skills Match');
      expect(blobContent).toContain('90%');
      
      // Verify it has print-optimized CSS
      expect(blobContent).toContain('@media print');
      expect(blobContent).toContain('@page');
    });
  });

  describe('isClipboardSupported', () => {
    it('should return true when clipboard API is supported', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true
      });
      
      expect(isClipboardSupported()).toBe(true);
    });

    it('should return true when execCommand copy is supported', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      mockDocumentMethods.queryCommandSupported.mockReturnValue(true);
      
      expect(isClipboardSupported()).toBe(true);
    });

    it('should return false when neither clipboard API nor execCommand is supported', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      mockDocumentMethods.queryCommandSupported.mockReturnValue(false);
      
      expect(isClipboardSupported()).toBe(false);
    });
  });
});