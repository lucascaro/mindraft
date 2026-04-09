/**
 * Firebase Admin SDK singleton — server-side only.
 *
 * Never import this file from client components or pages.
 * It reads secret environment variables that must NOT have a NEXT_PUBLIC_ prefix.
 *
 * Required env vars:
 *   FIREBASE_CLIENT_EMAIL   — service account email
 *   FIREBASE_PRIVATE_KEY    — PEM key (use \n for newlines in .env)
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID — reused from the existing client config
 */

import "server-only";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
