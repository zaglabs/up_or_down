/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["viem"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "polymarket.com",
      },
    ],
  },
};

export default nextConfig;
