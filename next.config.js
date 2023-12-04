/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    isrMemoryCacheSize: 0,
    incrementalCacheHandlerPath:
      process.env.NODE_ENV === "production" ||
      !!process.env.FIREBASE_DATABASE_EMULATOR_HOST
        ? require.resolve("./lib/rtdb-cache.js")
        : undefined,
  },
  generateBuildId: async () => {
    return process.env.BUILD_ID || "deadbeef";
  },
};

module.exports = nextConfig;
