import { NextResponse, type NextRequest } from "next/server";

// Per-request CSP with a nonce — the only way to allow Next.js's internal
// inline scripts (RSC streaming payload, runtime bootstrap, etc.) without
// resorting to 'unsafe-inline'. Requires dynamic rendering, which is fine
// for this app since every page is client-rendered auth-gated content.
//
// style-src uses 'unsafe-inline' because inline `style="..."` attributes
// on elements (used throughout the app for layout-shift prevention) can't
// carry a nonce — nonces only apply to <style> tags, not attributes.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = [
    `default-src 'self'`,
    // 'strict-dynamic' trusts any script loaded by a nonced script.
    // 'unsafe-eval' is required in dev for React's error stack helpers.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com`,
    `frame-src 'self' https://accounts.google.com https://*.firebaseapp.com`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets, Next.js internals, and
    // pure JSON API routes (which don't render HTML and don't need a CSP nonce).
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js|api/.*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
