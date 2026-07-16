"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Hash-based router supporting parameterized routes.
 * All views live under `/#/…` (single exposed `/` route).
 *
 * Routes (M1–M3):
 *   #/                    → dashboard
 *   #/items               → items list
 *   #/items/new           → add item form
 *   #/items/:id           → item detail
 *   #/items/:id/edit      → edit item form
 *   #/scan                → scan (hero)
 *   #/locations           → locations
 *   #/activity            → activity feed
 *   #/trash               → recently deleted
 *   #/settings            → settings (categories, locations, profile, export)
 */
export type Route =
  | { name: "dashboard" }
  | { name: "items" }
  | { name: "item-new" }
  | { name: "item-detail"; id: string }
  | { name: "item-edit"; id: string }
  | { name: "scan" }
  | { name: "locations" }
  | { name: "activity" }
  | { name: "settings" }
  | { name: "trash" };

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, "").trim();
  const parts = clean.split("/").filter(Boolean);

  if (parts.length === 0) return { name: "dashboard" };

  switch (parts[0]) {
    case "items":
      if (parts.length === 1) return { name: "items" };
      if (parts[1] === "new") return { name: "item-new" };
      if (parts.length === 3 && parts[2] === "edit")
        return { name: "item-edit", id: parts[1] };
      if (parts.length === 2) return { name: "item-detail", id: parts[1] };
      return { name: "items" };
    case "scan":
      return { name: "scan" };
    case "locations":
      return { name: "locations" };
    case "activity":
      return { name: "activity" };
    case "trash":
      return { name: "trash" };
    case "settings":
      return { name: "settings" };
    default:
      return { name: "dashboard" };
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case "dashboard":
      return "#/";
    case "items":
      return "#/items";
    case "item-new":
      return "#/items/new";
    case "item-detail":
      return `#/items/${route.id}`;
    case "item-edit":
      return `#/items/${route.id}/edit`;
    case "scan":
      return "#/scan";
    case "locations":
      return "#/locations";
    case "activity":
      return "#/activity";
    case "trash":
      return "#/trash";
    case "settings":
      return "#/settings";
    default:
      return "#/";
  }
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
    // Scroll to top on navigation
    window.scrollTo(0, 0);
  }, []);

  return [route, navigate];
}
