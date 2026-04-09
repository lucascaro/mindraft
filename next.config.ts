import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { THEME_INIT_SCRIPT } from "./src/lib/theme-init-script";

// SHA-256 hash of the inline theme-init script, computed at build time
// so the CSP `script-src` can allow exactly that script without needing
// `'unsafe-inline'`. Automatically updates if the script content changes.
const themeScriptHash = createHash("sha256")
  .update(THEME_INIT_SCRIPT)
  .digest("base64");

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'sha256-${themeScriptHash}' https://apis.google.com`,
  // Tailwind injects inline <style> tags; 'unsafe-inline' is required for
  // style-src until we move to nonce-based inline styles.
  `style-src 'self' 'unsafe-inline'`,
  // Google profile photos + PWA icon data URIs.
  `img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com`,
  `font-src 'self' data:`,
  // Firestore WebSocket + Firebase Auth + Google identity endpoints.
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com`,
  // Firebase Auth popup iframes itself from the project's firebaseapp.com
  // subdomain, and Google's account chooser uses accounts.google.com.
  `frame-src https://accounts.google.com https://*.firebaseapp.com`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
