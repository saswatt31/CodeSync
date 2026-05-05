/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // disabled to prevent double socket connections in dev
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  webpack: (config) => {
    // Required for simple-peer / WebRTC in Next.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
