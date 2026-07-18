import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { RESTORE_WINDOW_MS, type ItemListItem } from "@/lib/items";

// GET /api/items/deleted — recently deleted items (within 30-day window).
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowStart = new Date(Date.now() - RESTORE_WINDOW_MS);

  const items = await db.item.findMany({
    where: {
      isDeleted: true,
      deletedAt: { gte: windowStart },
    },
    orderBy: { deletedAt: "desc" },
    include: {
      category: { select: { name: true } },
      currentLocation: { select: { name: true } },
      homeLocation: { select: { name: true } },
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
    photoUrl: item.photoUrl,
    categoryName: item.category?.name ?? null,
    homeLocationId: item.homeLocationId,
    currentLocationId: item.currentLocationId,
    holderId: item.holderId,
    currentLocationName: item.currentLocation?.name ?? null,
    homeLocationName: item.homeLocation?.name ?? null,
    holderName: item.holder?.fullName ?? null,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  }));

  return NextResponse.json({ items: result });
}
