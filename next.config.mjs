import { withPostHogConfig } from "@posthog/nextjs-config";

/**
 * RFC 8288 Link headers advertising this origin's agent-facing resources.
 *
 * All relation types here are IANA-registered (`api-catalog` from RFC 9727,
 * `service-desc`/`service-doc`/`service-meta` from RFC 8631, `describedby`,
 * `terms-of-service`, `privacy-policy`) — an unregistered bare token would not
 * be a conforming relation type. Targets are relative URI references, so they
 * resolve against whichever origin served the response (preview, staging, prod).
 */
const AGENT_DISCOVERY_LINK = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"',
  '</llms.txt>; rel="service-doc"; type="text/plain"',
  '</.well-known/ai-catalog.json>; rel="service-meta"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  '</terms>; rel="terms-of-service"; type="text/html"',
  '</privacy>; rel="privacy-policy"; type="text/html"',
].join(", ");

const LINK_HEADER = { key: "Link", value: AGENT_DISCOVERY_LINK };

// Paths that serve markdown or HTML depending on Accept (see middleware.ts)
// must tell caches to key on it.
const VARY_ACCEPT = { key: "Vary", value: "Accept" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["pdf-parse", "mammoth", "winston-loki", "snappy"],
  async headers() {
    return [
      // Split so `/` and everything below it are matched by exactly one Link
      // rule — overlapping rules would emit the header twice. The `.+` in the
      // second pattern is what keeps it from also matching the bare root.
      { source: "/", headers: [LINK_HEADER, VARY_ACCEPT] },
      { source: "/:path((?!_next/|api/).+)", headers: [LINK_HEADER] },
      { source: "/free-tools", headers: [VARY_ACCEPT] },
      { source: "/blog", headers: [VARY_ACCEPT] },
      { source: "/blog/:slug", headers: [VARY_ACCEPT] },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only packages on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };

      // Add externals to prevent bundling these libraries on client side
      config.externals = config.externals || [];
      
      // Ignore winston-loki and its dependencies on client
      config.resolve.alias = {
        ...config.resolve.alias,
        'winston-loki': false,
        'snappy': false,
        '@napi-rs/snappy-darwin-arm64': false,
      };
    }
    
    return config;
  },
};

// Upload browser sourcemaps to PostHog at build time so production exceptions
// resolve to real file/function/line instead of mangled names like `$`.
// Gated on POSTHOG_API_KEY (a personal API key, set only in the Vercel build
// env): without it the plugin would fail the build, so local dev, previews, and
// forks fall back to the plain config and skip upload entirely.
const posthogApiKey = process.env.POSTHOG_API_KEY;

export default posthogApiKey
  ? withPostHogConfig(nextConfig, {
      personalApiKey: posthogApiKey,
      projectId: process.env.POSTHOG_PROJECT_ID,
      host: process.env.POSTHOG_HOST,
      sourcemaps: {
        enabled: true,
        // Don't leave sourcemaps in the deployed bundle after upload.
        deleteAfterUpload: true,
        ...(process.env.VERCEL_GIT_COMMIT_SHA
          ? { releaseName: process.env.VERCEL_GIT_COMMIT_SHA }
          : {}),
      },
    })
  : nextConfig;
