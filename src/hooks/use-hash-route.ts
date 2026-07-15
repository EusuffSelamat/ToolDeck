"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Lightweight hash-based router. The gateway only exposes `/`, so all views
 * live under `/#/…`. This keeps the browser back button, refresh, and
 * deep-linking working. On Vercel these can become real routes with no logic
 * changes.
 *
 * Routes (M1):
 *   #/            → dashboard
 *   #/items       → items list
 *   #/scan        → scan (hero)
 *   #/locations   → locations
 *   #/activity    → activity feed
 */
export type Route =
  | { name: "dashboard" }
  | { name: "items" }
  | { name: "scan" }
  | { name: "locations" }
  | { name: "activity" };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "").trim();
  switch (clean) {
    case "items":
      return { name: "items" };
    case "scan":
      return { name: "scan" };
    case "locations":
      return { name: "locations" };
    case "activity":
      return { name: "activity" };
    default:
      return { name: "dashboard" };
  }
}

export function routeToHash(route: Route): string {
  if (route.name === "dashboard") return "#/";
  return `#/${route.name}`;
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined"
      ? { name: "dashboard" }
      : parseHash(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((r: Route) => {
    const hash = routeToHash(r);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      setRoute(r);
    }
  }, []);

  return [route, navigate];
}
