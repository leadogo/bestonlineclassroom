import type { NextConfig } from "next";

// Security headers (William, 2026-09-20): no cost at runtime. The video is on Blob, so frame-ancestors 'none'
// here changes nothing about playback; it stops anyone framing the room, the admin or the moderator view.
const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: security }];
  },
  // The desk is /mod; these are what people type (Akash, Sep 23).
  async redirects() {
    return ["/moderate", "/moderator", "/desk"].map((source) => ({ source, destination: "/mod", permanent: false }));
  },
};

export default nextConfig;
