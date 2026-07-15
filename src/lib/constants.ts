/**
 * Client-safe constants — no server-only imports (no db, no Prisma).
 * Shared between client components and server routes.
 */

/** Soft-delete restore window — items past this age are purged permanently. */
export const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const RESTORE_WINDOW_DAYS = RESTORE_WINDOW_MS / 86400000;
