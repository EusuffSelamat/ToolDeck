import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  itemCreateSchema,
  nextItemCode,
  savePhoto,
  type ItemListItem,
  type TrackingType,
} from "@/lib/items";

// GET /api/items — list with search + filters.
// Query params: q, categoryId, status, locationId, trackingType,
//   holder=me, lowStock=true, deleted=false (default), page, limit
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const categoryId = url.searchParams.get("categoryId");
  const status = url.searchParams.get("status");
  const locationId = url.searchParams.get("locationId");
  const trackingType = url.searchParams.get("trackingType");
  const holderMe = url.searchParams.get("holder") === "me";
  const lowStock = url.searchParams.get("lowStock") === "true";
  const deleted = url.searchParams.get("deleted") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

  // Build the where clause
  const where: Record<string, unknown> = { isDeleted: deleted };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { brand: { contains: q } },
      { model: { contains: q } },
      { code: { contains: q } },
      { serialNo: { contains: q } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (locationId) where.currentLocationId = locationId;
  if (trackingType) where.trackingType = trackingType;
  if (holderMe) where.holderId = session.user.id;
  if (lowStock) {
    where.trackingType = "stock";
    where.isDeleted = false;
    // SQLite doesn't support column-to-column comparison in Prisma where,
    // so we filter low-stock in JS after fetching. At ≤2000 items this is fine.
  }

  const [total, items] = await Promise.all([
    db.item.count({ where }),
    db.item.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { name: true } },
        currentLocation: { select: { name: true } },
        homeLocation: { select: { name: true } },
        holder: { select: { fullName: true } },
      },
    }),
  ]);

  // Low-stock post-filter (quantity <= minQuantity)
  let result = items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    brand: item.brand,
    model: item.model,
    trackingType: item.trackingType as TrackingType,
    status: item.status,
    condition: item.condition,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    photoUrl: item.photoUrl,
    categoryName: item.category?.name ?? null,
    currentLocationName: item.currentLocation?.name ?? null,
    homeLocationName: item.homeLocation?.name ?? null,
    holderName: item.holder?.fullName ?? null,
    updatedAt: item.updatedAt,
  })) as ItemListItem[];

  if (lowStock) {
    result = result.filter((i) => i.quantity <= i.minQuantity);
  }

  return NextResponse.json({ items: result, total: lowStock ? result.length : total, page, limit });
}

// POST /api/items — create a new item.
// Assigns AST-####/STK-#### code, saves photo if provided, writes 'add' transaction.
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = itemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Assign code + save photo in a transaction
  const code = await nextItemCode(data.trackingType as TrackingType);

  let photoUrl: string | null = null;
  if (data.photoBase64) {
    try {
      photoUrl = await savePhoto(code, data.photoBase64);
    } catch {
      // Photo save failure is non-fatal — item still creates without photo
    }
  }

  // Set defaults: currentLocation falls back to homeLocation
  const currentLocationId = data.currentLocationId ?? data.homeLocationId ?? null;

  const item = await db.item.create({
    data: {
      code,
      name: data.name.trim(),
      brand: data.brand?.trim() || null,
      model: data.model?.trim() || null,
      serialNo: data.serialNo?.trim() || null,
      categoryId: data.categoryId || null,
      trackingType: data.trackingType,
      status: data.trackingType === "stock" ? "available" : "available",
      quantity: data.trackingType === "stock" ? data.quantity : 1,
      minQuantity: data.trackingType === "stock" ? data.minQuantity : 0,
      condition: data.condition,
      homeLocationId: data.homeLocationId || null,
      currentLocationId,
      notes: data.notes?.trim() || null,
      photoUrl,
      createdBy: session.user.id,
    },
  });

  // Write the 'add' audit transaction
  await db.transaction.create({
    data: {
      itemId: item.id,
      action: "add",
      personId: session.user.id,
      note: `Added as ${code}`,
    },
  });

  return NextResponse.json({ item: { id: item.id, code: item.code } }, { status: 201 });
}
