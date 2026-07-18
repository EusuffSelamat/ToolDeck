"use client";

import { useSession } from "next-auth/react";
import { normalizeRole, type Role } from "@/lib/roles";

/**
 * Returns the current user's role: "admin", "manager" or "worker".
 * Returns "worker" while loading (safe default — workers have fewest permissions).
 */
export function useRole(): Role {
  const { data: session } = useSession();
  return normalizeRole((session?.user as { role?: string } | undefined)?.role);
}
