"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const ua = navigator.userAgent;
    setIsIos(/iphone|ipad|ipod/i.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;

  // Android / Chrome — native prompt
  if (deferredPrompt) {
    return (
      <div role="status" aria-live="polite" className="fixed bottom-0 inset-x-0 p-4 bg-card border-t z-50">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Install Mindraft for quick access</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Dismiss install prompt"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await deferredPrompt.prompt();
                setDeferredPrompt(null);
              }}
            >
              Install
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // iOS — no native prompt, show manual instructions
  if (isIos) {
    return (
      <div role="status" aria-live="polite" className="fixed bottom-0 inset-x-0 p-4 bg-card border-t z-50">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
          <p className="text-sm">
            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> to install
          </p>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Dismiss install prompt"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
