"use client";

import { useCallback, useEffect, useState } from "react";

// Update-flow design:
//
//  1. On mount, if a new SW is already staged (`waiting` or `installing`),
//     we silently activate it. The resulting `controllerchange` triggers a
//     reload, so a manual refresh naturally lands the user on the new
//     version without a toast.
//  2. If an update arrives DURING the session (via `updatefound` after
//     mount), we surface a toast so the user can opt in to a reload
//     instead of being interrupted mid-work.
//  3. The toast's button reads the current registration at click time and
//     has a fallback reload in case `controllerchange` never fires.
//  4. `hadControllerAtMount` prevents the first-install `clients.claim()`
//     from triggering an unnecessary reload on brand-new visitors.
export function ServiceWorkerRegistrar() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const hadControllerAtMount = !!navigator.serviceWorker.controller;

    let hasReloaded = false;
    const onControllerChange = () => {
      // First install: no prior controller → don't reload the fresh page.
      if (!hadControllerAtMount) return;
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Tell a worker to skip waiting as soon as it reaches "installed".
    const activateWhenReady = (worker: ServiceWorker) => {
      if (worker.state === "installed") {
        worker.postMessage("SKIP_WAITING");
        return;
      }
      const onStateChange = () => {
        if (worker.state === "installed") {
          worker.postMessage("SKIP_WAITING");
          worker.removeEventListener("statechange", onStateChange);
        }
      };
      worker.addEventListener("statechange", onStateChange);
    };

    // Show the toast once the installing worker reaches "installed".
    const showToastWhenReady = (worker: ServiceWorker) => {
      const check = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      };
      check();
      worker.addEventListener("statechange", check);
    };

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // A new version is already staged at page load — the user likely
        // just refreshed expecting new content. Activate it now.
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage("SKIP_WAITING");
          return;
        }
        if (reg.installing && navigator.serviceWorker.controller) {
          activateWhenReady(reg.installing);
          return;
        }

        // Otherwise, listen for updates that arrive while the user is on the page.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) showToastWhenReady(newWorker);
        });
      })
      .catch((err) => {
        console.error("SW registration failed", err);
      });

    // Proactively check for updates when the tab becomes visible.
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage("SKIP_WAITING");
        // Fallback: if `controllerchange` doesn't land within 2s, force reload.
        setTimeout(() => window.location.reload(), 2000);
        return;
      }
    } catch {
      // fall through to reload
    }
    window.location.reload();
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 whitespace-nowrap rounded-lg border-2 border-primary bg-background px-4 py-3 shadow-lg text-sm">
      <span>A new version is available.</span>
      <button
        type="button"
        className="font-semibold text-primary underline-offset-2 hover:underline"
        onClick={handleRefresh}
      >
        Refresh
      </button>
    </div>
  );
}
