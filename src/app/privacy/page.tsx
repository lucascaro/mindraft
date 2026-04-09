import Link from "next/link";
import { Lightbulb, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Mindraft",
  description:
    "How Mindraft handles your ideas. No ads, no trackers, no data selling.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-primary/5">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated: April 9, 2026
            </p>
          </div>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-foreground/90">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-2">The short version</h2>
            <p className="text-muted-foreground">
              Your ideas are yours. Mindraft stores them so you can sync
              across devices, and nobody else reads them in the normal
              course of things. There are no ads, no analytics, no
              tracking pixels, and nothing is sold or used to train AI.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-2">What we collect</h2>
            <ul className="space-y-2 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground/90">From Google sign-in:</strong>{" "}
                your email, display name, profile photo, and Google user ID.
                These are provided by Firebase Auth (Google) when you sign in.
              </li>
              <li>
                <strong className="text-foreground/90">From you:</strong>{" "}
                the title, body, tags, and status of each idea you save.
                Stored in Firestore.
              </li>
              <li>
                <strong className="text-foreground/90">Timestamps:</strong>{" "}
                when each idea was created, updated, and (if applicable)
                archived.
              </li>
              <li>
                <strong className="text-foreground/90">Theme preference:</strong>{" "}
                light, dark, or system — stored in your browser&apos;s
                localStorage only, never sent to any server.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Who can see it</h2>
            <ul className="space-y-2 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground/90">You,</strong> when
                signed in to your Google account.
              </li>
              <li>
                <strong className="text-foreground/90">Google,</strong> as
                the operator of Firebase Auth and Firestore. Data is
                encrypted at rest with Google-managed keys, but Google runs
                the database and can technically access it if legally
                compelled or if their systems were compromised. If you want
                zero-knowledge, end-to-end encrypted storage, Mindraft
                isn&apos;t that today.
              </li>
              <li>
                <strong className="text-foreground/90">Vercel,</strong> as
                the hosting provider. Vercel sees request metadata (IP,
                user agent, URLs) but never the contents of your ideas —
                ideas are fetched directly from Firestore in your browser
                and never pass through Vercel.
              </li>
              <li>
                <strong className="text-foreground/90">Nobody else.</strong>{" "}
                No advertisers, no analytics providers, no AI training
                data sets, no resellers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-2">What we don&apos;t do</h2>
            <p className="text-muted-foreground">
              No analytics. No ads. No tracking pixels. No selling data. No
              training AI on your ideas. No marketing emails. No cross-site
              tracking. No cookies beyond what&apos;s required to keep you
              signed in.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Cookies and local storage</h2>
            <ul className="space-y-2 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground/90">Firebase Auth session:</strong>{" "}
                required to keep you signed in across visits.
              </li>
              <li>
                <strong className="text-foreground/90">
                  <code className="text-xs">mindraft-theme</code> in localStorage:
                </strong>{" "}
                your light/dark preference, on your device only.
              </li>
              <li>
                <strong className="text-foreground/90">Firestore offline cache:</strong>{" "}
                an IndexedDB mirror of your ideas so the app works offline.
                Wiped automatically when you sign out.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Your rights</h2>
            <ul className="space-y-2 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground/90">Export:</strong>{" "}
                download everything you&apos;ve ever saved as JSON from{" "}
                <Link
                  href="/settings"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Settings
                </Link>
                .
              </li>
              <li>
                <strong className="text-foreground/90">Delete:</strong>{" "}
                wipe your account and every idea from Settings. Deletion
                is permanent and immediate.
              </li>
              <li>
                <strong className="text-foreground/90">Access:</strong>{" "}
                everything Mindraft has about you is visible in the app
                itself — there&apos;s nothing hidden.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Data retention</h2>
            <p className="text-muted-foreground">
              Ideas live until you delete them. Archiving is reversible;
              deleting (from the archive view or by deleting your account)
              is permanent. When you delete your account, all of your ideas
              are removed from Firestore immediately, followed by your
              Firebase Auth record.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Third-party services</h2>
            <ul className="space-y-2 text-muted-foreground list-disc pl-5">
              <li>
                <strong className="text-foreground/90">Google Firebase</strong>{" "}
                (Auth + Firestore) —{" "}
                <a
                  href="https://firebase.google.com/support/privacy"
                  className="underline underline-offset-4 hover:text-foreground"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  privacy policy
                </a>
              </li>
              <li>
                <strong className="text-foreground/90">Vercel</strong> (hosting) —{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  className="underline underline-offset-4 hover:text-foreground"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  privacy policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Children</h2>
            <p className="text-muted-foreground">
              Mindraft is not directed at children under 13. If you believe
              a child under 13 has signed up, please contact us and the
              account will be removed.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Changes to this policy</h2>
            <p className="text-muted-foreground">
              Material changes will bump the &ldquo;Last updated&rdquo; date
              at the top of this page. Mindraft won&apos;t quietly start
              collecting new data without updating this policy first.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-2">Contact</h2>
            <p className="text-muted-foreground">
              Questions, concerns, or requests? Open an issue at{" "}
              <a
                href="https://github.com/lucascaro/mindraft/issues"
                className="underline underline-offset-4 hover:text-foreground"
                rel="noreferrer noopener"
                target="_blank"
              >
                github.com/lucascaro/mindraft/issues
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
