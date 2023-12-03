/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    isrMemoryCacheSize: 0, // disable default in-memory caching
  },
};

module.exports = nextConfig;
