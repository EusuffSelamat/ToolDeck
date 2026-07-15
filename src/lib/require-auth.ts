import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Auth gate for API routes — the Prisma+SQLite equivalent of Supabase RLS
 * (decision 1a). Every data-touching route must call this and return 401 if
 * the result is null. Authenticated users get full read/write on all rows
 * (matching §5 RLS: "authenticated users get select/insert/update on all
 * rows"). No delete policy — soft delete only (set isDeleted=true).
 *
 * Usage:
 *   const session = await requireAuth();
 *   if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   // session.user.id is the actor for audit transactions
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return session as {
    user: { id: string; name?: string | null; email: string };
  };
}
