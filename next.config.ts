import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin은 Node 전용 패키지 — 번들링하지 않고 런타임에서 require
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
