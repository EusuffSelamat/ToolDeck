/**
 * Role model (client-safe — no server imports).
 *
 *  admin   — full control: everything a manager can do PLUS user
 *            management (approve/reject accounts, change roles).
 *  manager — full inventory control: all 6 item actions, delete,
 *            restore, export, purge, category & location management.
 *  worker  — day-to-day use only: Check out, Return, Move.
 *  viewer  — read-only: browse dashboard/items/locations/activity and
 *            export the item list. No actions, no scan, no add.
 *            New sign-ups start here.
 */
export type Role = "admin" | "manager" | "worker" | "viewer";

/** True for roles with inventory-management powers (admin or manager). */
export function canManage(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

/** True for roles that can act on items at all (worker and above).
 * Viewers fail this — they are strictly read-only. */
export function canOperate(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager" || role === "worker";
}

/** Coerce an untrusted string into a known Role (defaults to viewer —
 * the least-privileged tier — while loading or for unknown values). */
export function normalizeRole(role: string | null | undefined): Role {
  return role === "admin" || role === "manager" || role === "worker"
    ? role
    : "viewer";
}
