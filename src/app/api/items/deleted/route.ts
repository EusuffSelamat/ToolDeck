import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import type { ItemListItem } from "@/lib/items";

// GET /api/items/deleted — recently deleted items (within 30-day window).
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const items = await db.item.findMany({
    where: {
      isDeleted: true,
      deletedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { deletedAt: "desc" },
    include: {
      category: { select: { name: true } },
      currentLocation: { select: { name: true } },
      holder: { select: { fullName: true } },
    },
  });

  const result: ItemListItem[] = items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    brand: item.brand,
    model: item.model,
    trackingType: item.trackingType as ItemListItem["trackingType"],
    status: item.status as ItemListItem["status"],
    condition: item.condition as ItemListItem["condition"],
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    photoUrl: item.photoUrl,
    categoryName: item.category?.name ?? null,
    currentLocationName: item.currentLocation?.name ?? null,
    homeLocationName: null,
    holderName: item.holder?.fullName ?? null,
    updatedAt: item.updatedAt,
  }));

  return NextResponse.json({ items: result });
}
