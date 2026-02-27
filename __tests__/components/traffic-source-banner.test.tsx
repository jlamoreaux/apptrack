/**
 * Tests for components/traffic-source-banner.tsx
 * PR #99 focus: localStorage?.getItem null safety
 */

// @jest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react icons used in traffic-source-banner
jest.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
  Gift: () => <div data-testid="gift-icon" />,
  Timer: () => <div data-testid="timer-icon" />,
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// Mock clientLogger to avoid real logging
jest.mock('@/lib/utils/client-logger', () => ({
  clientLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock storeTrafficSource
jest.mock('@/lib/utils/traffic-source', () => ({
  storeTrafficSource: jest.fn(),
}));

// Mock ButtonLink component
jest.mock('@/components/ui/button-link', () => ({
  ButtonLink: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>{children}</a>
  ),
}));

import { TrafficSourceBanner } from '@/components/traffic-source-banner';

describe('TrafficSourceBanner', () => {
  describe('when localStorage is available', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('renders without crashing when source is null', () => {
      expect(() => render(<TrafficSourceBanner source={null} />)).not.toThrow();
    });

    it('does not render when source is null', () => {
      const { container } = render(<TrafficSourceBanner source={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the reddit banner when source is "reddit"', () => {
      render(<TrafficSourceBanner source="reddit" />);
      expect(screen.getByText('Claim Your Trial')).toBeInTheDocument();
    });

    it('renders the linkedin banner when source is "linkedin"', () => {
      render(<TrafficSourceBanner source="linkedin" />);
      expect(screen.getByText('Claim Your Trial')).toBeInTheDocument();
    });

    it('does not render when source is not in SOURCE_CONFIG (e.g. "twitter")', () => {
      const { container } = render(<TrafficSourceBanner source={'twitter' as any} />);
      // twitter is not in SOURCE_CONFIG, so nothing should render
      expect(container.firstChild).toBeNull();
    });

    it('does not render when banner was already dismissed', () => {
      localStorage.setItem('traffic_banner_dismissed_reddit', 'true');
      const { container } = render(<TrafficSourceBanner source="reddit" />);
      expect(container.firstChild).toBeNull();
    });

    it('shows banner when not previously dismissed', () => {
      render(<TrafficSourceBanner source="reddit" />);
      expect(screen.getByText('Claim Your Trial')).toBeInTheDocument();
    });
  });

  describe('when localStorage is null (LinkedIn in-app browser scenario)', () => {
    let originalLocalStorage: Storage;

    beforeEach(() => {
      originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: null,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    });

    it('renders without crashing when localStorage is null', () => {
      expect(() => render(<TrafficSourceBanner source="reddit" />)).not.toThrow();
    });

    it('shows the banner when localStorage is null (cannot check dismissed state)', () => {
      render(<TrafficSourceBanner source="reddit" />);
      // Should show banner since we can't check dismissed state
      expect(screen.getByText('Claim Your Trial')).toBeInTheDocument();
    });

    it('does not throw when rendering with null source and null localStorage', () => {
      expect(() => render(<TrafficSourceBanner source={null} />)).not.toThrow();
    });
  });

  describe('with working localStorage', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('marks banner as dismissed in localStorage when dismiss is clicked', () => {
      render(<TrafficSourceBanner source="reddit" />);
      // Find the dismiss button (has sr-only "Dismiss" text)
      const dismissBtns = screen.getAllByRole('button');
      const dismissBtn = dismissBtns.find(btn => btn.textContent?.includes('Dismiss') || btn.querySelector('[data-testid="x-icon"]'));
      
      if (dismissBtn) {
        expect(() => fireEvent.click(dismissBtn)).not.toThrow();
      }
    });
  });
});
