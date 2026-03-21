/**
 * Tests for TrialOnboarding component
 * Tests tool card rendering, budget explanation, and "Got it" button.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrialOnboarding } from '@/components/ai-coach/trial-onboarding';

// Mock lucide-react icons (already mocked in jest.setup.js but adding specific ones)
jest.mock('lucide-react', () => ({
  BarChart3: () => <div data-testid="barchart3-icon" />,
  Briefcase: () => <div data-testid="briefcase-icon" />,
  Mail: () => <div data-testid="mail-icon" />,
}));

describe('TrialOnboarding', () => {
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all three tool cards', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    expect(screen.getByText('Job Fit Analysis')).toBeInTheDocument();
    expect(screen.getByText('Interview Prep')).toBeInTheDocument();
    expect(screen.getByText('Cover Letter')).toBeInTheDocument();
  });

  it('renders tool descriptions', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    expect(screen.getByText(/See how well your resume matches/)).toBeInTheDocument();
    expect(screen.getByText(/Get tailored interview questions/)).toBeInTheDocument();
    expect(screen.getByText(/Generate a customized cover letter/)).toBeInTheDocument();
  });

  it('shows budget explanation text', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    expect(screen.getByText(/You have 5 free analyses to use across any combination of tools/)).toBeInTheDocument();
  });

  it('shows the heading', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    expect(screen.getByText('Your AI career tools')).toBeInTheDocument();
  });

  it('shows suggestion text', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    expect(screen.getByText(/Start with Job Fit/)).toBeInTheDocument();
  });

  it('"Got it" button calls onComplete', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    const gotItButton = screen.getByText('Got it');
    expect(gotItButton).toBeInTheDocument();

    fireEvent.click(gotItButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders three icons', () => {
    render(<TrialOnboarding onComplete={onComplete} />);

    expect(screen.getByTestId('barchart3-icon')).toBeInTheDocument();
    expect(screen.getByTestId('briefcase-icon')).toBeInTheDocument();
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument();
  });
});
