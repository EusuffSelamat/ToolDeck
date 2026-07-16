import { db } from "@/lib/db";

/**
 * Location hierarchy helpers.
 * Locations can be nested: a Company Van (vehicle) can be "at" Tuas (site),
 * and items can be "in" the van. When viewing Tuas, you should see items
 * in the van too — so item counts and filters are recursive.
 */

const MAX_DEPTH = 16; // sanity cap — prevents infinite loops on corrupt data

/**
 * Fetch all locations once and build a parent→children map.
 * Shared across all descendant/isAncestor calls in the same request
 * to avoid N+1 queries.
 */
let cachedLocationMap: { map: Map<string | null, string[]>; parentMap: Map<string, string | null>; expiry: number } | null = null;
const MAP_CACHE_TTL = 10_000; // 10s

async function getLocationMaps() {
  const now = Date.now();
  if (cachedLocationMap && now < cachedLocationMap.expiry) {
    return cachedLocationMap;
  }
  const all = await db.location.findMany({
    select: { id: true, parentLocationId: true },
  });
  const map = new Map<string | null, string[]>();
  const parentMap = new Map<string, string | null>();
  for (const loc of all) {
    if (!map.has(loc.parentLocationId)) map.set(loc.parentLocationId, []);
    map.get(loc.parentLocationId)!.push(loc.id);
    parentMap.set(loc.id, loc.parentLocationId);
  }
  cachedLocationMap = { map, parentMap, expiry: now + MAP_CACHE_TTL };
  return cachedLocationMap;
}

/**
 * Returns the set of all descendant location IDs for a given parent,
 * NOT including the parent itself. Uses the shared location map.
 */
export async function getDescendantLocationIds(
  parentId: string
): Promise<Set<string>> {
  const { map: byParent } = await getLocationMaps();

  const descendants = new Set<string>();
  const queue = [parentId];
  let depth = 0;

  while (queue.length > 0 && depth < MAX_DEPTH) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const current = queue.shift()!;
      const children = byParent.get(current) ?? [];
      for (const childId of children) {
        if (!descendants.has(childId)) {
          descendants.add(childId);
          queue.push(childId);
        }
      }
    }
    depth++;
  }

  return descendants;
}

/**
 * Returns the set of location IDs that should be included when filtering
 * items by a location — i.e. the location itself + all its descendants.
 */
export async function getLocationAndDescendants(
  locationId: string
): Promise<Set<string>> {
  const descendants = await getDescendantLocationIds(locationId);
  descendants.add(locationId);
  return descendants;
}

/**
 * Walks up the parent chain from `startId` to check if `targetId` is an
 * ancestor. Uses the shared in-memory parent map — no per-node DB queries.
 */
export async function isAncestor(
  startId: string,
  targetId: string
): Promise<boolean> {
  const { parentMap } = await getLocationMaps();
  let cursor: string | null = startId;
  for (let i = 0; i < MAX_DEPTH && cursor; i++) {
    if (cursor === targetId) return true;
    cursor = parentMap.get(cursor) ?? null;
  }
  return false;
}
