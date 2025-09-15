/**
 * Integration tests for copy and download functionality in analysis components
 * Tests user interactions with copy and download buttons
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobFitAnalysisResult } from '@/components/ai-coach/results/JobFitAnalysisResult';
import type { JobFitAnalysisResult as JobFitAnalysisType } from '@/types/ai-analysis';

// Mock the export utilities
jest.mock('@/lib/utils/analysis-export', () => ({
  copyAnalysisToClipboard: jest.fn(),
  downloadAnalysisPDF: jest.fn(),
  isClipboardSupported: jest.fn().mockReturnValue(true)
}));

const mockCopyAnalysisToClipboard = jest.requireMock('@/lib/utils/analysis-export').copyAnalysisToClipboard;
const mockDownloadAnalysisPDF = jest.requireMock('@/lib/utils/analysis-export').downloadAnalysisPDF;

const mockAnalysis: JobFitAnalysisType = {
  overallScore: 85,
  scoreLabel: 'Excellent Match',
  strengths: [
    'Strong experience with React and modern JavaScript',
    'Proven track record in full-stack development'
  ],
  weaknesses: [
    'Limited experience with TypeScript',
    'Could benefit from more cloud platform knowledge'
  ],
  recommendations: [
    'Consider taking a TypeScript course',
    'Explore AWS or Google Cloud certifications'
  ],
  keyRequirements: [
    'React',
    'Node.js',
    'TypeScript'
  ],
  matchDetails: {
    skillsMatch: 90,
    experienceMatch: 85,
    educationMatch: 75
  },
  generatedAt: '2024-01-15T10:30:00.000Z'
};

describe('Analysis Export Integration', () => {
  const mockOnCopy = jest.fn();
  const mockOnDownload = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JobFitAnalysisResult Component', () => {
    it('should render copy and download buttons when callbacks are provided', () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
          showActions={true}
        />
      );

      expect(screen.getByRole('button', { name: /copy results/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();
    });

    it('should not render action buttons when showActions is false', () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
          showActions={false}
        />
      );

      expect(screen.queryByRole('button', { name: /copy results/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /download pdf/i })).not.toBeInTheDocument();
    });

    it('should call onCopy when copy button is clicked', async () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      await user.click(copyButton);

      expect(mockOnCopy).toHaveBeenCalledTimes(1);
    });

    it('should call onDownload when download button is clicked', async () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /download pdf/i });
      await user.click(downloadButton);

      expect(mockOnDownload).toHaveBeenCalledTimes(1);
    });

    it('should have proper accessibility attributes on action buttons', () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      const downloadButton = screen.getByRole('button', { name: /download pdf/i });

      // Buttons should be proper button elements and accessible
      expect(copyButton).toBeInTheDocument();
      expect(downloadButton).toBeInTheDocument();
      expect(copyButton).toBeInstanceOf(HTMLButtonElement);
      expect(downloadButton).toBeInstanceOf(HTMLButtonElement);
      
      // Buttons should be focusable and clickable
      expect(copyButton).not.toBeDisabled();
      expect(downloadButton).not.toBeDisabled();
    });

    it('should display icons in action buttons', () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      // Icons are mocked in jest.setup.js, so we check for their test IDs
      expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
      expect(screen.getByTestId('download-icon')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    const mockAnnounceSuccess = jest.fn();
    const mockAnnounceError = jest.fn();

    beforeEach(() => {
      // Mock console.error to avoid noise in test output
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should successfully copy analysis to clipboard', async () => {
      mockCopyAnalysisToClipboard.mockResolvedValue(undefined);

      const copyHandler = async () => {
        try {
          await mockCopyAnalysisToClipboard(mockAnalysis);
          mockAnnounceSuccess('Analysis copied to clipboard');
        } catch (error) {
          mockAnnounceError('Failed to copy results');
        }
      };

      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={copyHandler}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockCopyAnalysisToClipboard).toHaveBeenCalledWith(mockAnalysis);
        expect(mockAnnounceSuccess).toHaveBeenCalledWith('Analysis copied to clipboard');
      });
    });

    it('should handle copy failure gracefully', async () => {
      mockCopyAnalysisToClipboard.mockRejectedValue(new Error('Clipboard access denied'));

      const copyHandler = async () => {
        try {
          await mockCopyAnalysisToClipboard(mockAnalysis);
          mockAnnounceSuccess('Analysis copied to clipboard');
        } catch (error) {
          console.error('Copy failed:', error);
          mockAnnounceError('Failed to copy results');
        }
      };

      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={copyHandler}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockCopyAnalysisToClipboard).toHaveBeenCalledWith(mockAnalysis);
        expect(mockAnnounceError).toHaveBeenCalledWith('Failed to copy results');
        expect(console.error).toHaveBeenCalledWith('Copy failed:', expect.any(Error));
      });
    });
  });

  describe('Download Functionality', () => {
    const mockAnnounceSuccess = jest.fn();
    const mockAnnounceError = jest.fn();

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should successfully download analysis as PDF', async () => {
      mockDownloadAnalysisPDF.mockResolvedValue(undefined);

      const downloadHandler = async () => {
        try {
          await mockDownloadAnalysisPDF(mockAnalysis, {
            company: 'Tech Corp',
            role: 'Software Engineer'
          });
          mockAnnounceSuccess('Analysis report downloaded');
        } catch (error) {
          mockAnnounceError('Failed to download report');
        }
      };

      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={downloadHandler}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /download pdf/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockDownloadAnalysisPDF).toHaveBeenCalledWith(
          mockAnalysis,
          { company: 'Tech Corp', role: 'Software Engineer' }
        );
        expect(mockAnnounceSuccess).toHaveBeenCalledWith('Analysis report downloaded');
      });
    });

    it('should handle download failure gracefully', async () => {
      mockDownloadAnalysisPDF.mockRejectedValue(new Error('Download failed'));

      const downloadHandler = async () => {
        try {
          await mockDownloadAnalysisPDF(mockAnalysis, {
            company: 'Tech Corp',
            role: 'Software Engineer'
          });
          mockAnnounceSuccess('Analysis report downloaded');
        } catch (error) {
          console.error('Download failed:', error);
          mockAnnounceError('Failed to download report');
        }
      };

      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={downloadHandler}
        />
      );

      const downloadButton = screen.getByRole('button', { name: /download pdf/i });
      await user.click(downloadButton);

      await waitFor(() => {
        expect(mockDownloadAnalysisPDF).toHaveBeenCalledWith(
          mockAnalysis,
          { company: 'Tech Corp', role: 'Software Engineer' }
        );
        expect(mockAnnounceError).toHaveBeenCalledWith('Failed to download report');
        expect(console.error).toHaveBeenCalledWith('Download failed:', expect.any(Error));
      });
    });
  });

  describe('Button States and Interactions', () => {
    it('should handle rapid clicking without issues', async () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      
      // Simulate rapid clicking
      await user.click(copyButton);
      await user.click(copyButton);
      await user.click(copyButton);

      expect(mockOnCopy).toHaveBeenCalledTimes(3);
    });

    it('should maintain focus management for keyboard users', async () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      const downloadButton = screen.getByRole('button', { name: /download pdf/i });

      // Test keyboard navigation
      await user.tab();
      expect(document.activeElement).toBe(copyButton);

      await user.tab();
      expect(document.activeElement).toBe(downloadButton);

      // Test Enter key activation
      await user.keyboard('{Enter}');
      expect(mockOnDownload).toHaveBeenCalledTimes(1);
    });

    it('should work with Space key activation', async () => {
      render(
        <JobFitAnalysisResult
          analysis={mockAnalysis}
          onCopy={mockOnCopy}
          onDownload={mockOnDownload}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy results/i });
      
      copyButton.focus();
      await user.keyboard(' ');

      expect(mockOnCopy).toHaveBeenCalledTimes(1);
    });
  });
});