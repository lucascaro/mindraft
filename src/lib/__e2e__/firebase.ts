/**
 * E2E mock for @/lib/firebase.
 * Provides stub exports so modules that import from firebase.ts
 * don't try to initialize the real Firebase SDK.
 */
export const isFirebaseConfigured = true;

export function getDb(): never {
  throw new Error("getDb() should not be called in e2e mock mode");
}

export function getAuthInstance(): never {
  throw new Error("getAuthInstance() should not be called in e2e mock mode");
}

export const googleProvider = {};
