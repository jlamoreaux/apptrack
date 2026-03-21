/**
 * Tests for TrialBudgetNudge component
 * Tests escalating nudge banners, modal, dismiss, and PostHog events.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { capturePostHogEvent } from '@/lib/analytics/posthog';
import { TRIAL_BUDGET } from '@/lib/constants/ai-limits';
import type { TrialBudgetState } from '@/types';

// Override lucide-react mock to include X icon (not in jest.setup.js)
jest.mock('lucide-react', () => ({
  X: (props: any) => <div data-testid="x-icon" />,
}));

// Mock PostHog client-side analytics
jest.mock('@/lib/analytics/posthog', () => ({
  capturePostHogEvent: jest.fn(),
}));

const mockCapturePostHogEvent = capturePostHogEvent as jest.MockedFunction<typeof capturePostHogEvent>;

// Mock Dialog from radix to render in jsdom without portal issues
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children, className }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

// Must import after mocks
import { TrialBudgetNudge } from '@/components/ai-coach/trial-budget-nudge';

function makeBudget(overrides: Partial<TrialBudgetState> = {}): TrialBudgetState {
  return {
    analyses_used: 0,
    analyses_limit: TRIAL_BUDGET.LIMIT,
    analyses_remaining: TRIAL_BUDGET.LIMIT,
    is_pro: false,
    onboarding_completed: true,
    ...overrides,
  };
}

describe('TrialBudgetNudge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing for pro users', () => {
    const budget = makeBudget({ is_pro: true, analyses_used: 3, analyses_remaining: 999 });
    const { container } = render(<TrialBudgetNudge budget={budget} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no analyses have been used', () => {
    const budget = makeBudget({ analyses_used: 0, analyses_remaining: 5 });
    const { container } = render(<TrialBudgetNudge budget={budget} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows subtle banner when 2+ remaining', () => {
    const budget = makeBudget({ analyses_used: 2, analyses_remaining: 3 });
    render(<TrialBudgetNudge budget={budget} />);

    expect(screen.getByText(/3 analyses remaining/)).toBeInTheDocument();
    expect(screen.getByText(/upgrade for unlimited access/)).toBeInTheDocument();
  });

  it('shows prominent orange banner when 1 remaining', () => {
    const budget = makeBudget({ analyses_used: 4, analyses_remaining: 1 });
    const { container } = render(<TrialBudgetNudge budget={budget} />);

    expect(screen.getByText(/1 analysis remaining/)).toBeInTheDocument();
    expect(screen.getByText(/upgrade for unlimited/)).toBeInTheDocument();
    // Check for orange styling
    const banner = container.firstChild as HTMLElement;
    expect(banner.className).toContain('orange');
  });

  it('shows modal when 0 remaining', () => {
    const budget = makeBudget({ analyses_used: 5, analyses_remaining: 0 });
    render(<TrialBudgetNudge budget={budget} />);

    expect(screen.getByText('That was your last free analysis.')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    expect(screen.getByText('Maybe later')).toBeInTheDocument();
  });

  it('fires PostHog event when modal is shown', () => {
    const budget = makeBudget({ analyses_used: 5, analyses_remaining: 0 });
    render(<TrialBudgetNudge budget={budget} />);

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith('ai_trial_upgrade_modal_shown');
  });

  it('dismiss button hides the subtle banner', () => {
    const budget = makeBudget({ analyses_used: 2, analyses_remaining: 3 });
    render(<TrialBudgetNudge budget={budget} />);

    expect(screen.getByText(/3 analyses remaining/)).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    expect(screen.queryByText(/3 analyses remaining/)).not.toBeInTheDocument();
  });

  it('dismiss button hides the prominent banner', () => {
    const budget = makeBudget({ analyses_used: 4, analyses_remaining: 1 });
    render(<TrialBudgetNudge budget={budget} />);

    expect(screen.getByText(/1 analysis remaining/)).toBeInTheDocument();

    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);

    expect(screen.queryByText(/1 analysis remaining/)).not.toBeInTheDocument();
  });

  it('fires PostHog event when upgrade link is clicked on banner', () => {
    const budget = makeBudget({ analyses_used: 2, analyses_remaining: 3 });
    render(<TrialBudgetNudge budget={budget} />);

    const upgradeLink = screen.getByText(/upgrade for unlimited access/);
    fireEvent.click(upgradeLink);

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith('ai_trial_upgrade_clicked', { source: 'banner' });
  });

  it('fires PostHog event when upgrade button is clicked in modal', () => {
    const budget = makeBudget({ analyses_used: 5, analyses_remaining: 0 });
    render(<TrialBudgetNudge budget={budget} />);

    const upgradeButton = screen.getByText('Upgrade to Pro');
    fireEvent.click(upgradeButton);

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith('ai_trial_upgrade_clicked', { source: 'modal' });
  });

  it('"Maybe later" closes the modal', () => {
    const budget = makeBudget({ analyses_used: 5, analyses_remaining: 0 });
    render(<TrialBudgetNudge budget={budget} />);

    expect(screen.getByText('That was your last free analysis.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Maybe later'));

    // The dialog mock only renders children when open=true; after setModalOpen(false), it should unmount
    expect(screen.queryByText('That was your last free analysis.')).not.toBeInTheDocument();
  });
});
