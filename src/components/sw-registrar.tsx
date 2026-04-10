"use client";

import { useEffect, useRef, useState } from "react";

export function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      regRef.current = reg;

      const onUpdateFound = () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      };

      // New SW found after page load
      reg.addEventListener("updatefound", onUpdateFound);

      // SW already waiting (e.g. user returned to tab)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
    }).catch(() => {});

    // Reload once the new SW has taken control
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }, []);

  if (!updateAvailable) return null;

  const handleRefresh = () => {
    const waiting = regRef.current?.waiting;
    if (waiting) {
      waiting.postMessage("SKIP_WAITING");
    } else {
      // Waiting SW is gone (likely already activated); just reload
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 whitespace-nowrap rounded-lg border-2 border-primary bg-background px-4 py-3 shadow-lg text-sm">
      <span>A new version is available.</span>
      <button
        className="font-semibold text-primary underline-offset-2 hover:underline"
        onClick={handleRefresh}
      >
        Refresh
      </button>
    </div>
  );
}
