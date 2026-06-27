import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.4",
    "192.168.1.8",
    "localhost",
  ],
};

export default nextConfig;