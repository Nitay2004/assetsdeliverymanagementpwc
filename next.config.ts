import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const serverActionsAllowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  // The folder above this repo (PWC/PWC) carries its own package-lock.json.
  // Turbopack uses the nearest lockfile to guess the workspace root, so without
  // this it would pick that folder and then warn that the lockfile sits outside
  // the git repository. Pin the root to this project instead.
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(serverActionsAllowedOrigins.length > 0
    ? {
        experimental: {
          serverActions: {
            // Extra origins allowed for Server Action CSRF checks (comma-separated env).
            // Use for public IP/proxy access where Origin host differs from app Host.
            allowedOrigins: serverActionsAllowedOrigins,
          },
        },
      }
    : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
