import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { itemUpdateSchema, savePhoto, type ItemDetail } from "@/lib/items";

// GET /api/items/[id] — full detail with relations + transaction history
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const item = await db.item.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      homeLocation: { select: { name: true } },
      currentLocation: { select: { name: true } },
      holder: { select: { fullName: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          person: { select: { fullName: true } },
          holder: { select: { fullName: true } },
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
      },
    },
  });

  if (!item || (item.isDeleted && false)) {
    // Allow viewing deleted items from the trash view
  }
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const detail: ItemDetail = {
    id: item.id,
    code: item.code,
    name: item.name,
    brand: item.brand,
    model: item.model,
    serialNo: item.serialNo,
    categoryId: item.categoryId,
    categoryName: item.category?.name ?? null,
    trackingType: item.trackingType as ItemDetail["trackingType"],
    status: item.status as ItemDetail["status"],
    condition: item.condition as ItemDetail["condition"],
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    homeLocationId: item.homeLocationId,
    homeLocationName: item.homeLocation?.name ?? null,
    currentLocationId: item.currentLocationId,
    currentLocationName: item.currentLocation?.name ?? null,
    holderId: item.holderId,
    holderName: item.holder?.fullName ?? null,
    photoUrl: item.photoUrl,
    aiConfidence: item.aiConfidence,
    notes: item.notes,
    isDeleted: item.isDeleted,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    transactions: item.transactions.map((t) => ({
      id: t.id,
      action: t.action as ItemDetail["transactions"][number]["action"],
      qtyDelta: t.qtyDelta,
      note: t.note,
      createdAt: t.createdAt,
      personName: t.person?.fullName ?? null,
      holderName: t.holder?.fullName ?? null,
      fromLocationName: t.fromLocation?.name ?? null,
      toLocationName: t.toLocation?.name ?? null,
    })),
  };

  return NextResponse.json({ item: detail });
}

// PATCH /api/items/[id] — edit fields. Writes an 'edit' transaction.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db.item.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Handle photo: save new photo if provided (overwrites old filename since
  // photos are named by code, which is immutable)
  let photoUrl = existing.photoUrl;
  if (data.photoBase64) {
    try {
      photoUrl = await savePhoto(existing.code, data.photoBase64);
    } catch {
      // non-fatal
    }
  }

  // Build update data (only provided fields)
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.brand !== undefined) updateData.brand = data.brand?.trim() || null;
  if (data.model !== undefined) updateData.model = data.model?.trim() || null;
  if (data.serialNo !== undefined) updateData.serialNo = data.serialNo?.trim() || null;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity;
  if (data.condition !== undefined) updateData.condition = data.condition;
  if (data.homeLocationId !== undefined) updateData.homeLocationId = data.homeLocationId || null;
  if (data.currentLocationId !== undefined) updateData.currentLocationId = data.currentLocationId || null;
  if (data.holderId !== undefined) updateData.holderId = data.holderId || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
  if (photoUrl !== existing.photoUrl) updateData.photoUrl = photoUrl;

  const item = await db.item.update({
    where: { id },
    data: updateData,
  });

  // Write 'edit' audit transaction
  await db.transaction.create({
    data: {
      itemId: item.id,
      action: "edit",
      personId: session.user.id,
      note: "Details updated",
    },
  });

  return NextResponse.json({ item: { id: item.id } });
}

// DELETE /api/items/[id] — soft delete. Sets isDeleted=true, writes 'delete' transaction.
// Restorable for 30 days via the "Recently deleted" view.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.item.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.item.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await db.transaction.create({
    data: {
      itemId: id,
      action: "delete",
      personId: session.user.id,
      note: `Soft-deleted ${existing.code}`,
    },
  });

  return NextResponse.json({ ok: true, id });
}
