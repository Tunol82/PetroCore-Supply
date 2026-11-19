"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. Dev keeps its own HMR
 * connection, and a cached shell there causes confusing stale pages.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration is a progressive enhancement; the app works without it.
    });
  }, []);

  return null;
}
