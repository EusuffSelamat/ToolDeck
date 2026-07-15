/**
 * Passes a location filter from the Locations view to the Items list.
 * Supports two modes:
 *   - "current": filter by currentLocationId (items currently AT this location)
 *   - "home": filter by homeLocationId (items whose HOME is this location)
 */

const KEY = "tooldeck:location-filter";

export type LocationFilterMode = "current" | "home";

export function setLocationFilter(
  locationId: string,
  locationName: string,
  mode: LocationFilterMode = "current"
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ locationId, locationName, mode }));
}

export function getLocationFilter(): {
  locationId: string;
  locationName: string;
  mode: LocationFilterMode;
} | null {
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
