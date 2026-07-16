"use client";

import { useSession } from "next-auth/react";

/**
 * Returns the current user's role: "admin" or "worker".
 * Returns "worker" while loading (safe default — workers have fewer permissions).
 */
export function useRole(): "admin" | "worker" {
  const { data: session } = useSession();
  return (session?.user as { role?: string } | undefined)?.role === "admin"
    ? "admin"
    : "worker";
}
