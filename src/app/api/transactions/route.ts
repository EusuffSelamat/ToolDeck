import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

/**
 * GET /api/transactions — reverse-chronological audit trail feed (§7.9).
 *
 * Query params:
 *   - action: filter by action type (add, checkout, checkin, move, adjust_qty, condition, edit, delete, restore)
 *   - personId: filter by who performed the action
 *   - itemId: filter to a specific item
 *   - limit: max results (default 50, max 200)
 *
 * Returns transactions with item, person, holder, from/to location context —
 * enough to render human-readable sentences like:
 *   "Sarah checked out AST-0042 Angle grinder → Site B · yesterday 16:20"
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
