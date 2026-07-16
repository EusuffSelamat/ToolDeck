import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

/**
 * GET /api/stats — dashboard summary statistics.
 *
 * Returns:
 *   - totalItems, available, checkedOut, needsService
 *   - overdueReturns (checked out past expectedReturnDate)
 *   - byCategory: [{ name, count }] for the radar
 *   - recentActivity: last 5 transactions for the feed preview
 *   - needsAttention: items needing action (overdue, needs_service)
 */
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const whereActive = { isDeleted: false };

  const [
    totalItems,
    available,
    checkedOut,
    needsService,
    outOfOrder,
    overdueItems,
    byCategory,
    byLocation,
    recentActivity,
    maintenanceDueSoon,
  ] = await Promise.all([
    db.item.count({ where: whereActive }),
    db.item.count({ where: { ...whereActive, status: "available" } }),
    db.item.count({ where: { ...whereActive, status: "checked_out" } }),
    db.item.count({ where: { ...whereActive, status: "needs_service" } }),
    db.item.count({ where: { ...whereActive, status: "out_of_order" } }),
    // Overdue: checked out with expectedReturnDate < today
    db.item.findMany({
      where: {
        ...whereActive,
        status: "checked_out",
        expectedReturnDate: { lt: new Date() },
      },
      select: {
        id: true,
        code: true,
        name: true,
        expectedReturnDate: true,
        holder: { select: { fullName: true } },
      },
    }),
    // By category
    db.category.findMany({
      orderBy: { sort: "asc" },
      select: {
        name: true,
        _count: { select: { items: { where: { isDeleted: false } } } },
      },
    }),
    // By location (for the locations panel)
    db.location.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kind: true,
        _count: {
          select: { itemsCurrent: { where: { isDeleted: false } } },
        },
      },
    }),
    // Recent activity (last 5)
    db.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        item: { select: { id: true, code: true, name: true, isDeleted: true } },
        person: { select: { fullName: true } },
      },
    }),
    // Maintenance due soon (nextDue within 14 days, item not deleted)
    db.maintenanceLog.findMany({
      where: {
        nextDue: { lte: new Date(Date.now() + 14 * 86400000) },
        item: { isDeleted: false },
      },
      orderBy: { nextDue: "asc" },
      take: 10,
      select: {
        id: true,
        nextDue: true,
        description: true,
        item: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    totalItems,
    available,
    checkedOut,
    needsService,
    outOfOrder,
    overdueReturns: overdueItems.length,
    overdueItems,
    byCategory: byCategory
      .map((c) => ({ name: c.name, count: c._count.items }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count),
    byLocation: byLocation
      .map((l) => ({ id: l.id, name: l.name, kind: l.kind, count: l._count.itemsCurrent }))
      .filter((l) => l.count > 0)
      .sort((a, b) => b.count - a.count),
    recentActivity: recentActivity.map((t) => ({
      id: t.id,
      action: t.action,
      note: t.note,
      createdAt: t.createdAt,
      itemCode: t.item?.code ?? null,
      itemName: t.item?.name ?? null,
      itemId: t.item?.id ?? null,
      itemIsDeleted: t.item?.isDeleted ?? false,
      personName: t.person?.fullName ?? null,
    })),
    maintenanceDueSoon: maintenanceDueSoon.map((m) => ({
      id: m.id,
      nextDue: m.nextDue,
      description: m.description,
      itemId: m.item.id,
      itemCode: m.item.code,
      itemName: m.item.name,
    })),
  });
}
