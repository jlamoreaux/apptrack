import { withPostHogConfig } from "@posthog/nextjs-config";

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
