/**
 * jest.mock factories shared by the MCP tool tests. This module imports
 * nothing, so a factory can load it without pulling in the modules it mocks.
 *
 *   jest.mock("@/lib/analytics/posthog-server", () =>
 *     jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").posthogServerMock()
 *   );
 */

/** This module's shape, for typing jest.requireActual in a mock factory. */
export interface McpMocks {
  posthogServerMock: () => PosthogServerMock;
  loggerServiceMock: () => LoggerServiceMock;
}

export interface PosthogServerMock {
  captureServerEvent: jest.Mock;
}

export interface LoggerServiceMock {
  loggerService: Record<"error" | "warn" | "info" | "debug", jest.Mock>;
}

export function posthogServerMock(): PosthogServerMock {
  return { captureServerEvent: jest.fn().mockResolvedValue(undefined) };
}

export function loggerServiceMock(): LoggerServiceMock {
  return {
    loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
  };
}
