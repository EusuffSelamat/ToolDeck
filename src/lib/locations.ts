import { db } from "@/lib/db";

/**
 * Location hierarchy helpers.
 * Locations can be nested: a Company Van (vehicle) can be "at" Tuas (site),
 * and items can be "in" the van. When viewing Tuas, you should see items
 * in the van too — so item counts and filters are recursive.
 */

const MAX_DEPTH = 16; // sanity cap — prevents infinite loops on corrupt data

/**
 * Returns the set of all descendant location IDs for a given parent,
 * NOT including the parent itself. Uses a single DB query + in-memory BFS.
 */
export async function getDescendantLocationIds(
  parentId: string
): Promise<Set<string>> {
  const all = await db.location.findMany({
    select: { id: true, parentLocationId: true },
  });

  const byParent = new Map<string | null, string[]>();
  for (const loc of all) {
    const key = loc.parentLocationId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(loc.id);
  }

  const descendants = new Set<string>();
  const queue = [parentId];
  let depth = 0;

  while (queue.length > 0 && depth < MAX_DEPTH) {
    const current = queue.shift()!;
    const children = byParent.get(current) ?? [];
    for (const childId of children) {
      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
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
 * ancestor. Used to prevent circular references when setting a parent.
 * Returns true if `targetId` is found in the ancestor chain (cycle detected).
 */
export async function isAncestor(
  startId: string,
  targetId: string
): Promise<boolean> {
  let cursor: string | null = startId;
  for (let i = 0; i < MAX_DEPTH && cursor; i++) {
    if (cursor === targetId) return true;
    const node = await db.location.findUnique({
      where: { id: cursor },
      select: { parentLocationId: true },
    });
    cursor = node?.parentLocationId ?? null;
  }
  return false;
}
