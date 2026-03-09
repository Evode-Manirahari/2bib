/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@pe/types'],
  experimental: {},
};

module.exports = nextConfig;
