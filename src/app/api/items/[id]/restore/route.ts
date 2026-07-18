import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canManage } from "@/lib/roles";
import { isRestorable } from "@/lib/items";

// POST /api/items/[id]/restore — restore a soft-deleted item.
// Writes a 'restore' transaction. Items older than 30 days are not restorable
// (the trash view filters them out, but we enforce server-side too).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only managers/admins can restore deleted items
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: "Manager access required to restore items." }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.item.findUnique({ where: { id } });
  if (!existing || !existing.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 30-day window enforcement (server-side, consistent with trash list)
  if (!isRestorable(existing.deletedAt)) {
    return NextResponse.json(
      { error: "This item can no longer be restored (older than 30 days)." },
      { status: 410 }
    );
  }

  // Transaction: restore + audit are atomic
  await db.$transaction(async (tx) => {
    await tx.item.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });

    await tx.transaction.create({
      data: {
        itemId: id,
        action: "restore",
        personId: session.user.id,
        note: `Restored ${existing.code}`,
      },
    });
  });

  return NextResponse.json({ ok: true, id });
}
