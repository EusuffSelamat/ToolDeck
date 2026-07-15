import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { RESTORE_WINDOW_MS, deletePhoto } from "@/lib/items";

/**
 * POST /api/items/purge — permanently delete items soft-deleted more than
 * 30 days ago. Cleans up their photo files too.
 *
 * This endpoint is designed to be called by a cron job (Vercel Cron,
 * node-cron, etc.) once daily. It's auth-gated so it can also be triggered
 * manually by an admin.
 *
 * In a serverless context, this runs as a background task. At ≤2000-item
 * scale the query is fast. For larger datasets, batch the deletes.
 */
export async function POST() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RESTORE_WINDOW_MS);

  // Find items to purge (need photoUrl before deleting)
  const toPurge = await db.item.findMany({
    where: {
      isDeleted: true,
      deletedAt: { lt: cutoff },
    },
    select: { id: true, code: true, photoUrl: true },
  });

  if (toPurge.length === 0) {
    return NextResponse.json({ purged: 0 });
  }

  // Hard-delete in a transaction (cascades to transactions + maintenance_logs)
  const result = await db.item.deleteMany({
    where: {
      id: { in: toPurge.map((i) => i.id) },
    },
  });

  // Clean up photo files (non-transactional, best-effort)
  for (const item of toPurge) {
    await deletePhoto(item.photoUrl).catch(() => {});
  }

  console.log(`Purged ${result.count} expired items past the 30-day window.`);

  return NextResponse.json({ purged: result.count });
}
