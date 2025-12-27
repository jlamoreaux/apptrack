/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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

export default nextConfig;
