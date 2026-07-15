/**
 * Passes a location filter from the Locations view to the Items list.
 * When you tap a location card, this stores the location ID; the items view
 * reads it on mount and applies the filter.
 */

const KEY = "tooldeck:location-filter";

export function setLocationFilter(locationId: string, locationName: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ locationId, locationName }));
}

export function getLocationFilter(): { locationId: string; locationName: string } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocationFilter(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
