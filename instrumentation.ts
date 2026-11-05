import type { Instrumentation } from "next";

/**
 * Reports errors that escape route handlers, server components, server actions, and
 * proxy to PostHog Error Tracking. Errors a handler catches and turns into a response
 * never reach this hook.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // posthog-node needs the Node.js runtime; the edge runtime has no error hook here.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ captureServerException }, { distinctIdFromCookieHeader }] = await Promise.all([
    import("./lib/analytics/posthog-server"),
    import("./lib/analytics/posthog-cookie"),
  ]);

  await captureServerException(error, distinctIdFromCookieHeader(request.headers.cookie), {
    $exception_source: "server",
    // Query strings can carry tokens and emails; keep the path only.
    request_path: request.path.split("?")[0],
    request_method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
    router_kind: context.routerKind,
    render_source: context.renderSource,
  });
};
