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
      // Proxy Firebase Auth handler requests to Firebase Hosting so that
      // signInWithRedirect works on browsers that block third-party storage.
      // Set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN to your app's own host (e.g.
      // mindraft-ten.vercel.app) so the SDK redirects through this proxy
      // instead of cross-origin to firebaseapp.com.
      // See: https://firebase.google.com/docs/auth/web/redirect-best-practices
      {
        source: "/__/:path*",
        destination: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com/__/:path*`,
      },
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

  // In e2e mock mode, replace Firebase modules with in-memory mocks
  // so Playwright tests run without a real Firebase project.
  turbopack: process.env.NEXT_PUBLIC_E2E_MOCK === "true"
    ? {
        resolveAlias: {
          "@/lib/firestore": "./src/lib/__e2e__/firestore.ts",
          "@/lib/auth-context": "./src/lib/__e2e__/auth-context.tsx",
          "@/lib/firebase": "./src/lib/__e2e__/firebase.ts",
        },
      }
    : {},
};

export default nextConfig;
