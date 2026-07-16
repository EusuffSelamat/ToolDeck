"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker (§4). Data stays live — the SW only
 * caches navigations and static assets. Registration runs client-side only.
 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Register after load so it never competes with first paint.
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures are non-fatal */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
