import type { NextConfig } from "next";
import { execSync } from "child_process";

function getBuildId(): string {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return Date.now().toString();
  }
}

// Non-CSP security headers. CSP itself is set per-request in `src/proxy.ts`
// because nonce generation requires dynamic rendering.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  env: {
    BUILD_ID: getBuildId(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  async rewrites() {
    return [
      // OAuth 2.0 well-known endpoints required by the MCP Authorization spec.
      // Next.js ignores directories prefixed with ".", so we serve these from
      // normal API routes and rewrite the canonical paths here.
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/resource",
      },
    ];
  },

  // Prevent firebase-admin (and its native Node.js modules) from being
  // bundled into client-side chunks. It must only run on the server.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
