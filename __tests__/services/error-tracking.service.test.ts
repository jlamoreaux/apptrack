/**
 * Tests for lib/services/error-tracking.service.ts
 * PR #99 focus: cross-origin "Script error." filtering
 */

// @jest-environment jsdom

// Mock the analytics service dependency
jest.mock('@/lib/services/analytics.service', () => ({
  analyticsService: {
    trackEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ErrorTrackingService, errorTrackingService } from '@/lib/services/error-tracking.service';
import { analyticsService } from '@/lib/services/analytics.service';

const mockTrackEvent = analyticsService.trackEvent as jest.Mock;

describe('ErrorTrackingService', () => {
  let service: ErrorTrackingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ErrorTrackingService();
  });

  describe('trackError', () => {
    it('sends javascript_error event to analytics for a real error', async () => {
      const err = new Error('Something went wrong');
      await service.trackError(err);

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const call = mockTrackEvent.mock.calls[0][0];
      expect(call.name).toBe('javascript_error');
      expect(call.properties.error_message).toBe('Something went wrong');
      expect(call.properties.error_type).toBe('javascript');
    });

    it('includes context properties when provided', async () => {
      const err = new Error('Auth failed');
      await service.trackError(err, { userId: 'user-123', component: 'Login' });

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const props = mockTrackEvent.mock.calls[0][0].properties;
      expect(props.userId).toBe('user-123');
      expect(props.component).toBe('Login');
    });

    it('does not throw when analytics.trackEvent throws', async () => {
      mockTrackEvent.mockRejectedValueOnce(new Error('Analytics down'));
      const err = new Error('Test error');
      await expect(service.trackError(err)).resolves.not.toThrow();
    });

    it('flattens metadata into top-level properties', async () => {
      const err = new Error('Test');
      await service.trackError(err, {
        metadata: { filename: 'app.js', lineno: 42 },
      });

      const props = mockTrackEvent.mock.calls[0][0].properties;
      expect(props.metadata_filename).toBe('app.js');
      expect(props.metadata_lineno).toBe(42);
    });
  });

  describe('trackAPIError', () => {
    it('sends api_error event with correct properties', async () => {
      await service.trackAPIError('/api/users', 'GET', 404, 'Not found');

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      const call = mockTrackEvent.mock.calls[0][0];
      expect(call.name).toBe('api_error');
      expect(call.properties.endpoint).toBe('/api/users');
      expect(call.properties.method).toBe('GET');
      expect(call.properties.status_code).toBe(404);
      expect(call.properties.error_message).toBe('Not found');
      expect(call.properties.error_type).toBe('api');
    });

    it('does not throw when analytics service fails', async () => {
      mockTrackEvent.mockRejectedValueOnce(new Error('Analytics down'));
      await expect(
        service.trackAPIError('/api/test', 'POST', 500, 'Server error')
      ).resolves.not.toThrow();
    });
  });

  describe('trackComponentError', () => {
    it('sends component_error event with component name', async () => {
      const err = new Error('Render failed');
      await service.trackComponentError('DashboardPage', err);

      const call = mockTrackEvent.mock.calls[0][0];
      expect(call.name).toBe('component_error');
      expect(call.properties.component_name).toBe('DashboardPage');
      expect(call.properties.error_message).toBe('Render failed');
      expect(call.properties.error_type).toBe('react');
    });
  });

  describe('initializeGlobalHandlers', () => {
    it('does not crash when called in browser context', () => {
      expect(() => service.initializeGlobalHandlers()).not.toThrow();
    });

    it.todo('does not attach listeners when window is undefined — tested in Node env (jsdom cannot truly unset window)');


    describe('global error handler — cross-origin filtering (PR #99)', () => {
      it('does NOT call trackError for "Script error." cross-origin events', () => {
        service.initializeGlobalHandlers();
        const trackErrorSpy = jest.spyOn(service, 'trackError');

        // Simulate cross-origin script error
        const event = new ErrorEvent('error', {
          message: 'Script error.',
          filename: '',
          lineno: 0,
          colno: 0,
        });
        window.dispatchEvent(event);

        expect(trackErrorSpy).not.toHaveBeenCalled();
        trackErrorSpy.mockRestore();
      });

      it('does NOT call trackError for "Script error" (without period)', () => {
        service.initializeGlobalHandlers();
        const trackErrorSpy = jest.spyOn(service, 'trackError');

        const event = new ErrorEvent('error', { message: 'Script error' });
        window.dispatchEvent(event);

        expect(trackErrorSpy).not.toHaveBeenCalled();
        trackErrorSpy.mockRestore();
      });

      it('DOES call trackError for real errors with meaningful messages', () => {
        service.initializeGlobalHandlers();
        const trackErrorSpy = jest.spyOn(service, 'trackError').mockResolvedValue(undefined);

        const event = new ErrorEvent('error', {
          message: 'TypeError: Cannot read property of undefined',
          filename: '/app/dashboard/page.tsx',
          lineno: 42,
          colno: 10,
        });
        window.dispatchEvent(event);

        expect(trackErrorSpy).toHaveBeenCalledTimes(1);
        trackErrorSpy.mockRestore();
      });

      it('does not throw when a cross-origin "Script error." is received', () => {
        service.initializeGlobalHandlers();

        expect(() => {
          const event = new ErrorEvent('error', { message: 'Script error.' });
          window.dispatchEvent(event);
        }).not.toThrow();
      });
    });
  });

  describe('singleton errorTrackingService', () => {
    it('is an instance of ErrorTrackingService', () => {
      expect(errorTrackingService).toBeInstanceOf(ErrorTrackingService);
    });
  });
});
