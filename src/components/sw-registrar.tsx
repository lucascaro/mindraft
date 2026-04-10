"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegistrar() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      const onUpdateFound = () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingSW(newWorker);
          }
        });
      };

      // New SW found after page load
      reg.addEventListener("updatefound", onUpdateFound);

      // SW already waiting (e.g. user returned to tab)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingSW(reg.waiting);
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

  if (!waitingSW) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg text-sm">
      <span>A new version is available.</span>
      <button
        className="font-medium text-primary underline-offset-2 hover:underline"
        onClick={() => waitingSW.postMessage("SKIP_WAITING")}
      >
        Refresh
      </button>
    </div>
  );
}
