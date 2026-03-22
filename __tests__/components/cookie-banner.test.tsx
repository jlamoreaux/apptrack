/**
 * Tests for components/cookie-banner.tsx
 * PR #99 focus: localStorage?.getItem null safety
 */

// @jest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock lucide-react icons not in jest.setup.js
jest.mock('lucide-react', () => ({
  Cookie: () => <div data-testid="cookie-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock next/link (already in jest.setup.js but included for clarity)
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

import { CookieBanner } from '@/components/cookie-banner';

describe('CookieBanner', () => {
  describe('when localStorage is available', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Clear localStorage before each test
      localStorage.clear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders the banner when no cookie consent is stored', () => {
      render(<CookieBanner />);
      // Banner is delayed — advance timers to trigger visibility
      act(() => { jest.advanceTimersByTime(4000); });
      expect(screen.getByRole('heading', { name: 'We use cookies' })).toBeInTheDocument();
    });

    it('renders "Accept All" and "Necessary Only" buttons', () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      expect(screen.getByText('Accept All')).toBeInTheDocument();
      expect(screen.getByText('Necessary Only')).toBeInTheDocument();
    });

    it('does not render the banner when cookie consent is already stored', () => {
      const consent = JSON.stringify({ necessary: true, analytics: true, marketing: false, personalization: false });
      localStorage.setItem('cookie-consent', consent);

      render(<CookieBanner />);
      expect(screen.queryByRole('heading', { name: 'We use cookies' })).not.toBeInTheDocument();
    });

    it('hides the banner after clicking "Accept All"', async () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      const acceptAllBtn = screen.getByText('Accept All');
      fireEvent.click(acceptAllBtn);
      // Banner should no longer be visible
      expect(screen.queryByRole('heading', { name: 'We use cookies' })).not.toBeInTheDocument();
    });

    it('stores cookie consent to localStorage on "Accept All"', async () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      fireEvent.click(screen.getByText('Accept All'));
      const stored = localStorage.getItem('cookie-consent');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.analytics).toBe(true);
      expect(parsed.necessary).toBe(true);
    });

    it('hides the banner after clicking "Necessary Only"', () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      fireEvent.click(screen.getByText('Necessary Only'));
      expect(screen.queryByRole('heading', { name: 'We use cookies' })).not.toBeInTheDocument();
    });

    it('shows preferences panel when "Preferences" button is clicked', () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      const prefsBtn = screen.getByText('Preferences');
      fireEvent.click(prefsBtn);
      expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();
    });
  });

  describe('when localStorage is null (LinkedIn in-app browser scenario)', () => {
    let originalLocalStorage: Storage;

    beforeEach(() => {
      jest.useFakeTimers();
      originalLocalStorage = window.localStorage;
      // Simulate LinkedIn in-app browser where localStorage is null
      Object.defineProperty(window, 'localStorage', {
        value: null,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    });

    it('renders without crashing when localStorage is null', () => {
      expect(() => render(<CookieBanner />)).not.toThrow();
    });

    it('shows the banner when localStorage is null (cannot check consent)', () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      expect(screen.getByRole('heading', { name: 'We use cookies' })).toBeInTheDocument();
    });

    it('does not throw when clicking "Accept All" with null localStorage', () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      expect(() => fireEvent.click(screen.getByText('Accept All'))).not.toThrow();
    });

    it('does not throw when clicking "Necessary Only" with null localStorage', () => {
      render(<CookieBanner />);
      act(() => { jest.advanceTimersByTime(4000); });
      expect(() => fireEvent.click(screen.getByText('Necessary Only'))).not.toThrow();
    });
  });
});
