import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @mediapipe from being bundled server-side (browser-only package)
  serverExternalPackages: ['@mediapipe/tasks-vision'],
};

export default nextConfig;
