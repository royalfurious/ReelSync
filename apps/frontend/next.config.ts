import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Double-invoking effects in dev opens a duplicate real LiveKit session under the
  // same participant identity, which races the server and drops the real connection.
  reactStrictMode: false,
  transpilePackages: ['@watch-party/shared', '@watch-party/db'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      }
    ];
  }
};

export default nextConfig;