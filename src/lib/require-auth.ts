import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  user: { id: string; name?: string | null; email: string; role: "admin" | "worker" };
};

/**
 * Auth gate for API routes — the Prisma+SQLite equivalent of Supabase RLS.
 * Every data-touching route must call this and return 401 if null.
 */
export async function requireAuth(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session as SessionUser;
}

/**
 * Admin-only gate. Returns the session if the user is an admin, null otherwise.
 * Use when a route should be completely restricted to admins.
 */
export async function requireAdmin(): Promise<SessionUser | null> {
  const session = await requireAuth();
  if (!session) return null;
  if (session.user.role !== "admin") return null;
  return session;
}
