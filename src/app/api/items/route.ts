import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canOperate } from "@/lib/roles";
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
//   holder=me, deleted=false (default), page, limit
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
  const deleted = url.searchParams.get("deleted") === "true";
  const page = safeInt(url.searchParams.get("page"), 1);
  // Exports need a higher cap than the UI list. Export is available to
  // every signed-in role (viewers included) — it's read-only.
  const isExport = url.searchParams.get("export") === "true";
  const requestedLimit = safeInt(url.searchParams.get("limit"), 200);
  const limit = Math.min(isExport ? 5000 : 500, requestedLimit);

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
  // Location filters are recursive: tapping "Tuas" shows items at Tuas
  // AND items in child locations (e.g. the Company Van parked at Tuas).
  if (locationId) {
    const { getLocationAndDescendants } = await import("@/lib/locations");
    const locationIds = await getLocationAndDescendants(locationId);
    where.currentLocationId = { in: Array.from(locationIds) };
  }
  if (homeLocationId) {
    const { getLocationAndDescendants } = await import("@/lib/locations");
    const locationIds = await getLocationAndDescendants(homeLocationId);
    where.homeLocationId = { in: Array.from(locationIds) };
  }
  if (trackingType) {
    where.trackingType = trackingType;
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
        currentLocation: { select: { name: true, parentLocationId: true, parent: { select: { name: true } } } },
        homeLocation: { select: { name: true, parentLocationId: true, parent: { select: { name: true } } } },
        holder: { select: { fullName: true } },
        createdByUser: { select: { fullName: true } },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { person: { select: { fullName: true } } },
        },
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
    serialNo: item.serialNo,
    trackingType: item.trackingType as TrackingType,
    status: item.status,
    condition: item.condition,
    quantity: item.quantity,
    photoUrl: item.photoUrl,
    categoryName: item.category?.name ?? null,
    homeLocationId: item.homeLocationId,
    currentLocationId: item.currentLocationId,
    currentLocationName: item.currentLocation?.name ?? null,
    currentLocationParentName: item.currentLocation?.parent?.name ?? null,
    homeLocationName: item.homeLocation?.name ?? null,
    homeLocationParentName: item.homeLocation?.parent?.name ?? null,
    holderId: item.holderId,
    holderName: item.holder?.fullName ?? null,
    expectedReturnDate: item.expectedReturnDate,
    createdByName: item.createdByUser?.fullName ?? null,
    createdAt: item.createdAt,
    updatedByName: item.transactions[0]?.person?.fullName ?? null,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt,
  })) as ItemListItem[];

  return NextResponse.json({
    items: result,
    total,
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
  // Viewers are read-only — they cannot add items.
  if (!canOperate(session.user.role)) {
    return NextResponse.json(
      { error: "Your account is view-only. Ask an admin for access." },
      { status: 403 }
    );
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
