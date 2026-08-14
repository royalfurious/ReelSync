import type { NextConfig } from 'next';

// Server-side only: where Next.js proxies /api/* to. Falls back to the local
// backend for dev. Set this to the deployed backend's URL in production so the
// rewrite (and same-origin auth cookies that depend on it) keep working.
const backendUrl = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Double-invoking effects in dev opens a duplicate real LiveKit session under the
  // same participant identity, which races the server and drops the real connection.
  reactStrictMode: false,
  transpilePackages: ['@watch-party/shared', '@watch-party/db'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;