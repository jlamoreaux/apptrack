/**
 * Tests for analysis export utility functions
 * Tests clipboard copying and PDF download functionality
 */

// Mock jsPDF and html2canvas before importing the module
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({
    text: jest.fn(),
    setFontSize: jest.fn(),
    save: jest.fn(),
    addPage: jest.fn(),
    setFont: jest.fn(),
    setTextColor: jest.fn(),
    setFillColor: jest.fn(),
    setDrawColor: jest.fn(),
    setLineWidth: jest.fn(),
    rect: jest.fn(),
    line: jest.fn(),
    splitTextToSize: jest.fn().mockReturnValue([]),
    internal: {
      pageSize: {
        getWidth: jest.fn().mockReturnValue(210),
        getHeight: jest.fn().mockReturnValue(297),
      }
    }
  }))
}));

jest.mock('html2canvas', () => jest.fn());

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
    it('should create and download a PDF file', async () => {
      const mockPDF = {
        internal: {
          pageSize: {
            getWidth: jest.fn().mockReturnValue(210),
            getHeight: jest.fn().mockReturnValue(297)
          }
        },
        setFont: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        setFillColor: jest.fn(),
        setDrawColor: jest.fn(),
        setLineWidth: jest.fn(),
        rect: jest.fn(),
        line: jest.fn(),
        text: jest.fn(),
        splitTextToSize: jest.fn().mockReturnValue(['line 1', 'line 2']),
        addPage: jest.fn(),
        save: jest.fn()
      };
      
      const { jsPDF } = require('jspdf');
      jsPDF.mockReturnValue(mockPDF);
      
      const applicationInfo = {
        company: 'Tech Corp',
        role: 'Software Engineer'
      };
      
      await downloadAnalysisPDF(mockAnalysis, applicationInfo);
      
      // Verify PDF methods were called
      expect(mockPDF.setFont).toHaveBeenCalled();
      expect(mockPDF.setFontSize).toHaveBeenCalled();
      expect(mockPDF.save).toHaveBeenCalled();
    });

    it('should generate proper filename with company and role info', async () => {
      const mockPDF = {
        internal: {
          pageSize: {
            getWidth: jest.fn().mockReturnValue(210),
            getHeight: jest.fn().mockReturnValue(297)
          }
        },
        setFont: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        setFillColor: jest.fn(),
        setDrawColor: jest.fn(),
        setLineWidth: jest.fn(),
        rect: jest.fn(),
        line: jest.fn(),
        text: jest.fn(),
        splitTextToSize: jest.fn().mockReturnValue(['line 1']),
        addPage: jest.fn(),
        save: jest.fn()
      };
      
      const { jsPDF } = require('jspdf');
      jsPDF.mockReturnValue(mockPDF);
      
      await downloadAnalysisPDF(mockAnalysis, {
        company: 'Tech Corp Inc',
        role: 'Senior Software Engineer'
      });
      
      expect(mockPDF.save).toHaveBeenCalledWith(
        'job-fit-analysis-tech-corp-inc-senior-software-engineer.pdf'
      );
    });

    it('should include analysis data in PDF content', async () => {
      const mockPDF = {
        internal: {
          pageSize: {
            getWidth: jest.fn().mockReturnValue(210),
            getHeight: jest.fn().mockReturnValue(297)
          }
        },
        setFont: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        setFillColor: jest.fn(),
        setDrawColor: jest.fn(),
        setLineWidth: jest.fn(),
        rect: jest.fn(),
        line: jest.fn(),
        text: jest.fn(),
        splitTextToSize: jest.fn().mockReturnValue(['line 1']),
        addPage: jest.fn(),
        save: jest.fn()
      };
      
      const { jsPDF } = require('jspdf');
      jsPDF.mockReturnValue(mockPDF);
      
      await downloadAnalysisPDF(mockAnalysis, {
        company: 'Tech Corp',
        role: 'Software Engineer'
      });
      
      // Verify PDF text method was called with analysis data
      const textCalls = mockPDF.text.mock.calls.map((call: any) => call[0]);
      const allText = textCalls.join(' ');
      
      // Verify it contains analysis data
      expect(allText).toContain('Job Fit Analysis Report');
      expect(allText).toContain('Tech Corp');
      expect(allText).toContain('Software Engineer');
      
      // Verify score was formatted and added
      expect(mockPDF.text).toHaveBeenCalledWith(
        expect.stringContaining('85%'),
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
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