/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the dashboard to call its own API routes during build
  experimental: { serverComponentsExternalPackages: ["@vercel/kv"] },
};

module.exports = nextConfig;
