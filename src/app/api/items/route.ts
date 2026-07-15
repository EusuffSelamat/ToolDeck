import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import {
  itemCreateSchema,
  nextItemCode,
  savePhoto,
  deletePhoto,
  type ItemListItem,
  type TrackingType,
} from "@/lib/items";

function safeInt(val: string | null, fallback: number): number {
  const n = parseInt(val ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// GET /api/items — list with search + filters.
// Query params: q, categoryId, status, locationId, trackingType,
//   holder=me, lowStock=true, deleted=false (default), page, limit
export async function GET(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 200) || "";
  const categoryId = url.searchParams.get("categoryId");
  const status = url.searchParams.get("status");
  const locationId = url.searchParams.get("locationId");
  const homeLocationId = url.searchParams.get("homeLocationId");
  const trackingType = url.searchParams.get("trackingType");
  const holderMe = url.searchParams.get("holder") === "me";
  const lowStock = url.searchParams.get("lowStock") === "true";
  const deleted = url.searchParams.get("deleted") === "true";
  const page = safeInt(url.searchParams.get("page"), 1);
  // Raise the cap to 2000 (the documented scale) so lists + exports don't truncate.
  // lowStock uses a high take because the post-filter reduces the result set.
  const requestedLimit = safeInt(url.searchParams.get("limit"), 200);
  const limit = Math.min(lowStock ? 2000 : 500, requestedLimit);

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
  if (homeLocationId) where.homeLocationId = homeLocationId;
  // lowStock implies stock type — but don't overwrite an explicit trackingType
  if (trackingType) {
    where.trackingType = trackingType;
  } else if (lowStock) {
    where.trackingType = "stock";
  }
  if (holderMe) where.holderId = session.user.id;

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

  // Low-stock post-filter (SQLite can't compare columns in WHERE)
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
    homeLocationId: item.homeLocationId,
    currentLocationId: item.currentLocationId,
    currentLocationName: item.currentLocation?.name ?? null,
    homeLocationName: item.homeLocation?.name ?? null,
    holderId: item.holderId,
    holderName: item.holder?.fullName ?? null,
    expectedReturnDate: item.expectedReturnDate,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  })) as ItemListItem[];

  if (lowStock) {
    result = result.filter((i) => i.quantity <= i.minQuantity);
  }

  return NextResponse.json({
    items: result,
    total: lowStock ? result.length : total,
    page,
    limit,
    hasMore: page * limit < total,
  });
}

// POST /api/items — create a new item.
// Assigns AST-####/STK-#### code, saves photo if provided, writes 'add' transaction.
// Retries on code-collision (P2002) up to 3 times.
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

  // Set defaults: currentLocation falls back to homeLocation
  const currentLocationId = data.currentLocationId ?? data.homeLocationId ?? null;

  // Retry loop for code-assignment race condition
  const MAX_RETRIES = 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = await nextItemCode(data.trackingType as TrackingType);

    // Save photo to temp file before DB create (atomic rename happens in savePhoto)
    let photoUrl: string | null = null;
    let photoSaved = false;
    if (data.photoBase64) {
      try {
        photoUrl = await savePhoto(code, data.photoBase64);
        photoSaved = true;
      } catch (e) {
        console.error("Photo save failed on create:", e);
        // Non-fatal — item creates without photo, user is warned
      }
    }

    try {
      // Transaction: item create + audit transaction are atomic
      const item = await db.$transaction(async (tx) => {
        const created = await tx.item.create({
          data: {
            code,
            name: data.name.trim(),
            brand: data.brand?.trim() || null,
            model: data.model?.trim() || null,
            serialNo: data.serialNo?.trim() || null,
            categoryId: data.categoryId || null,
            trackingType: data.trackingType,
            status: "available",
            quantity: data.trackingType === "stock" ? data.quantity : 1,
            minQuantity: data.trackingType === "stock" ? data.minQuantity : 0,
            condition: data.condition,
            homeLocationId: data.homeLocationId || null,
            currentLocationId,
            notes: data.notes?.trim() || null,
            photoUrl,
            aiConfidence: data.aiConfidence ?? null,
            createdBy: session.user.id,
          },
        });

        await tx.transaction.create({
          data: {
            itemId: created.id,
            action: "add",
            personId: session.user.id,
            note: `Added as ${code}`,
          },
        });

        return created;
      });

      return NextResponse.json(
        { item: { id: item.id, code: item.code }, photoSaved },
        { status: 201 }
      );
    } catch (e) {
      lastError = e;

      // P2002 = unique constraint violation (code collision) — retry with next code
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Clean up the orphaned photo from this failed attempt
        if (photoSaved && photoUrl) {
          await deletePhoto(photoUrl).catch(() => {});
        }
        continue; // retry with a fresh code
      }

      // P2003 = FK constraint — category/location doesn't exist
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        if (photoSaved && photoUrl) await deletePhoto(photoUrl).catch(() => {});
        return NextResponse.json(
          { error: "Selected category or location no longer exists." },
          { status: 400 }
        );
      }

      // Other errors — clean up photo and rethrow
      if (photoSaved && photoUrl) await deletePhoto(photoUrl).catch(() => {});
      console.error("Item create failed:", e);
      return NextResponse.json(
        { error: "Could not create item. Please try again." },
        { status: 500 }
      );
    }
  }

  // Exhausted retries
  console.error("Item create failed after retries:", lastError);
  return NextResponse.json(
    { error: "Could not assign a unique code. Please try again." },
    { status: 503 }
  );
}
