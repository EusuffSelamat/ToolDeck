import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = {
  user: { id: string; name?: string | null; email: string; role: "admin" | "worker" };
};

/**
 * Auth gate for API routes — the Prisma+SQLite equivalent of Supabase RLS.
 * Every data-touching route must call this and return 401 if null.
 *
 * Because sessions are stateless JWTs, approval status and role would
 * otherwise only be checked at sign-in — a user rejected (or demoted)
 * AFTER signing in would keep access until the token expires. So we
 * re-validate against the database on every request: the user must still
 * exist and still be approved (admins bypass approval, same as sign-in),
 * and the role reflected to callers is the CURRENT one, not the token's.
 */
export async function requireAuth(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const id = (session.user as { id?: string }).id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: { role: true, approvalStatus: true },
  });
  if (!user) return null; // account deleted — token no longer valid
  if (user.role !== "admin" && user.approvalStatus !== "approved") return null;

  (session.user as { role?: string }).role = user.role;
  return session as unknown as SessionUser;
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
