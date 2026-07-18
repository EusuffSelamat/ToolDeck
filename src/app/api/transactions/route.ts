import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canManage } from "@/lib/roles";

/**
 * GET /api/transactions — reverse-chronological audit trail feed (§7.9).
 *
 * Query params:
 *   - action: filter by action type
 *   - personId: filter by who performed the action
 *   - itemId: filter to a specific item
 *   - limit: max results (default 50, max 10000 for exports)
 */
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const personId = url.searchParams.get("personId");
  const itemId = url.searchParams.get("itemId");
  const limitParam = url.searchParams.get("limit");
  // For exports, allow up to 10000 transactions. Default 50 for UI.
  const limit = Math.min(10000, Math.max(1, parseInt(limitParam || "50", 10) || 50));

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (personId) where.personId = personId;
  if (itemId) where.itemId = itemId;

  const transactions = await db.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          photoUrl: true,
          isDeleted: true,
        },
      },
      person: { select: { fullName: true } },
      holder: { select: { fullName: true } },
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
    },
  });

  const result = transactions.map((t) => ({
    id: t.id,
    action: t.action,
    qtyDelta: t.qtyDelta,
    note: t.note,
    createdAt: t.createdAt,
    item: t.item
      ? {
          id: t.item.id,
          code: t.item.code,
          name: t.item.name,
          photoUrl: t.item.photoUrl,
          isDeleted: t.item.isDeleted,
        }
      : null,
    personName: t.person?.fullName ?? null,
    holderName: t.holder?.fullName ?? null,
    fromLocationName: t.fromLocation?.name ?? null,
    toLocationName: t.toLocation?.name ?? null,
  }));

  return NextResponse.json({ transactions: result });
}

/**
 * DELETE /api/transactions — permanently delete transaction records.
 * This is a destructive, irreversible action. The audit trail is cleared.
 * Items themselves are NOT affected — only the transaction history.
 *
 * Optional query params:
 *   - before=ISO_DATE — only delete transactions older than this date
 *   - olderThanDays=N — only delete transactions older than N days
 *   - (no params) — delete ALL transactions
 */
export async function DELETE(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only managers/admins can purge activity logs
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: "Manager access required to delete activity logs." }, { status: 403 });
  }

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const olderThanDays = url.searchParams.get("olderThanDays");

  let where: Record<string, unknown> = {};

  if (before) {
    const date = new Date(before);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'before' date." },
        { status: 400 }
      );
    }
    where.createdAt = { lt: date };
  } else if (olderThanDays) {
    const days = parseInt(olderThanDays, 10);
    if (isNaN(days) || days < 1) {
      return NextResponse.json(
        { error: "Invalid 'olderThanDays' value." },
        { status: 400 }
      );
    }
    const cutoff = new Date(Date.now() - days * 86400000);
    where.createdAt = { lt: cutoff };
  }

  const result = await db.transaction.deleteMany({ where });

  return NextResponse.json({
    deleted: result.count,
    scope: before
      ? `before ${new Date(before).toLocaleDateString("en-SG")}`
      : olderThanDays
      ? `older than ${olderThanDays} days`
      : "all",
  });
}
