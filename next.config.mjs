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
  serverExternalPackages: ["pdf-parse", "mammoth"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle pdf-parse and mammoth on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };

      // Add externals to prevent bundling these libraries on client side
      config.externals = config.externals || [];
    }
    return config;
  },
};

export default nextConfig;
