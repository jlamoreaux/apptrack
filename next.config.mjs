import { agentDiscoveryHeaders } from "./lib/constants/agent-discovery-links.mjs";
import { oauthFramingHeaders } from "./lib/constants/oauth-framing-headers.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `eslint` was removed as a config option in Next 16, and `next lint` with it.
  // Linting had in fact been dead for some time: .eslintrc.json extends
  // `next/core-web-vitals` but `eslint-config-next` was never installed.

  typescript: {
    // Still supported in 16. The real control is `pnpm typecheck:ratchet`, which holds a
    // committed error baseline that may not grow.
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 narrowed the default from "any quality" to [75]. Without this, the two
    // call sites below are silently coerced down:
    //   components/product-showcase.tsx  quality={85}
    //   IMAGE_QUALITY_HERO               80
    qualities: [75, 80, 85],
  },
  // No serverExternalPackages: pdf-parse is gone (replaced by unpdf) and mammoth is now
  // imported via its prebuilt browser bundle, which has no Node dependencies to exclude.
  turbopack: {
    resolveAlias: {
      // `resend` lazily imports @react-email/render, an OPTIONAL peer it only needs for
      // the `react:` body option. This app always sends `html` strings, so the package is
      // not installed. Webpack tolerated the unresolvable dynamic import; Turbopack — the
      // Next 16 default for `next build` — fails the build on it.
      //
      // The stub throws a clear error if the `react:` path is ever used, rather than
      // resolving to an empty module that would fail later with "render is not a function".
      //
      // NOTE: vinext ignores Turbopack config entirely. This alias must be re-expressed as
      // a Vite `resolve.alias` entry when the app moves off Next.
      "@react-email/render": "./lib/stubs/react-email-render.ts",
    },
  },
  async headers() {
    return [...agentDiscoveryHeaders(), ...oauthFramingHeaders()];
  },
};

// No `webpack()` block. Next 16 uses Turbopack for `next build` by default and *fails the
// build* when a webpack config is present. The block that used to live here aliased
// `winston-loki`, `snappy` and `@napi-rs/snappy-darwin-arm64` — none of which are
// dependencies — plus fs/path/os fallbacks that mask client-side imports of server-only
// modules rather than fixing them. If a genuine need reappears, use `turbopack.resolveAlias`
// rather than reintroducing webpack.
//
// `withPostHogConfig` is also gone: it injects a webpack config, which triggers the same
// build failure from a plugin rather than from this file. Browser sourcemap upload moves to
// PostHog's Vite plugin when the app moves to vinext. Until then, production exceptions
// resolve to minified frames — a deliberate, temporary trade.
export default nextConfig;
