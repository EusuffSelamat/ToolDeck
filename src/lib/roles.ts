/**
 * Role model (client-safe — no server imports).
 *
 *  admin   — full control: everything a manager can do PLUS user
 *            management (approve/reject accounts, change roles).
 *  manager — full inventory control: all 6 item actions, delete,
 *            restore, export, purge, category & location management.
 *  worker  — day-to-day use only: Check out, Return, Move.
 */
export type Role = "admin" | "manager" | "worker";

/** True for roles with inventory-management powers (admin or manager). */
export function canManage(role: string | null | undefined): boolean {
  return role === "admin" || role === "manager";
}

/** Coerce an untrusted string into a known Role (defaults to worker). */
export function normalizeRole(role: string | null | undefined): Role {
  return role === "admin" || role === "manager" ? role : "worker";
}
