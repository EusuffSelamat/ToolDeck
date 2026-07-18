import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canManage } from "@/lib/roles";
import {
  itemUpdateSchema,
  savePhoto,
  isRestorable,
  type ItemDetail,
} from "@/lib/items";

// GET /api/items/[id] — full detail with relations + transaction history.
// Returns deleted items too (so the detail view can show a "deleted" banner).
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
        take: 50,
        include: {
          person: { select: { fullName: true } },
          holder: { select: { fullName: true } },
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
      },
    },
  });

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
    homeLocationId: item.homeLocationId,
    homeLocationName: item.homeLocation?.name ?? null,
    currentLocationId: item.currentLocationId,
    currentLocationName: item.currentLocation?.name ?? null,
    holderId: item.holderId,
    holderName: item.holder?.fullName ?? null,
    expectedReturnDate: item.expectedReturnDate,
    photoUrl: item.photoUrl,
    aiConfidence: item.aiConfidence,
    notes: item.notes,
    isDeleted: item.isDeleted,
    deletedAt: item.deletedAt,
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

// PATCH /api/items/[id] — edit fields. Writes an 'edit' transaction with a
// summary of changed fields. Skips the write entirely if nothing changed.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only managers/admins can edit item details
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: "Admin access required to edit items." }, { status: 403 });
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

  // Handle photo: save new photo if provided
  let photoUrl = existing.photoUrl;
  let photoChanged = false;
  if (data.photoBase64) {
    try {
      photoUrl = await savePhoto(existing.code, data.photoBase64);
      photoChanged = true;
    } catch (e) {
      console.error("Photo save failed on edit:", e);
      return NextResponse.json(
        { error: "Could not save photo. Item was not updated." },
        { status: 500 }
      );
    }
  }

  // Build update data (only provided fields) + track changed field names
  const updateData: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (data.name !== undefined && data.name.trim() !== existing.name) {
    updateData.name = data.name.trim();
    changedFields.push("name");
  }
  if (data.brand !== undefined && (data.brand?.trim() || null) !== existing.brand) {
    updateData.brand = data.brand?.trim() || null;
    changedFields.push("brand");
  }
  if (data.model !== undefined && (data.model?.trim() || null) !== existing.model) {
    updateData.model = data.model?.trim() || null;
    changedFields.push("model");
  }
  if (data.serialNo !== undefined && (data.serialNo?.trim() || null) !== existing.serialNo) {
    updateData.serialNo = data.serialNo?.trim() || null;
    changedFields.push("serial");
  }
  if (data.categoryId !== undefined && (data.categoryId || null) !== existing.categoryId) {
    updateData.categoryId = data.categoryId || null;
    changedFields.push("category");
  }
  if (data.status !== undefined && data.status !== existing.status) {
    updateData.status = data.status;
    changedFields.push("status");
  }
  if (data.quantity !== undefined && data.quantity !== existing.quantity) {
    updateData.quantity = data.quantity;
    changedFields.push("quantity");
  }
  if (data.condition !== undefined && data.condition !== existing.condition) {
    updateData.condition = data.condition;
    changedFields.push("condition");
    // Sync status to match condition (same logic as the /action route)
    const newStatus =
      data.condition === "needs_service"
        ? "needs_service"
        : data.condition === "out_of_order"
        ? "out_of_order"
        : existing.status === "checked_out"
        ? "checked_out"
        : "available";
    if (newStatus !== existing.status) {
      updateData.status = newStatus;
      changedFields.push("status");
    }
  }
  // Resolve "Same as home" (null/empty) to the actual home location ID
  // BEFORE comparing, so the update fires correctly.
  const effectiveHomeId =
    (data.homeLocationId !== undefined ? data.homeLocationId : existing.homeLocationId) || null;

  if (data.homeLocationId !== undefined && (data.homeLocationId || null) !== existing.homeLocationId) {
    updateData.homeLocationId = data.homeLocationId || null;
    changedFields.push("home location");
    // If current location was the same as the old home, sync it to the new home
    if (existing.currentLocationId === existing.homeLocationId || existing.currentLocationId === null) {
      updateData.currentLocationId = data.homeLocationId || null;
      changedFields.push("current location");
    }
  }

  if (data.currentLocationId !== undefined) {
    // "Same as home" (null/empty) resolves to the home location ID
    const resolvedCurrent = data.currentLocationId || effectiveHomeId;
    if (resolvedCurrent !== existing.currentLocationId) {
      updateData.currentLocationId = resolvedCurrent;
      changedFields.push("current location");
    }
  }
  if (data.holderId !== undefined && (data.holderId || null) !== existing.holderId) {
    updateData.holderId = data.holderId || null;
    changedFields.push("holder");
  }
  if (data.notes !== undefined && (data.notes?.trim() || null) !== existing.notes) {
    updateData.notes = data.notes?.trim() || null;
    changedFields.push("notes");
  }
  if (data.aiConfidence !== undefined && data.aiConfidence !== existing.aiConfidence) {
    updateData.aiConfidence = data.aiConfidence;
    changedFields.push("AI confidence");
  }
  if (photoChanged) {
    updateData.photoUrl = photoUrl;
    changedFields.push("photo");
  }

  // No changes — skip the write and the audit transaction
  if (changedFields.length === 0) {
    return NextResponse.json({ item: { id }, unchanged: true });
  }

  try {
    // Transaction: update + audit are atomic
    await db.$transaction(async (tx) => {
      await tx.item.update({
        where: { id },
        data: updateData,
      });

      await tx.transaction.create({
        data: {
          itemId: id,
          action: "edit",
          personId: session.user.id,
          note: `Updated: ${changedFields.join(", ")}`,
        },
      });
    });

    return NextResponse.json({ item: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Selected category or location no longer exists." },
        { status: 400 }
      );
    }
    console.error("Item update failed:", e);
    return NextResponse.json(
      { error: "Could not update item. Please try again." },
      { status: 500 }
    );
  }
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
  // Only managers/admins can delete items
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: "Admin access required to delete items." }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.item.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Transaction: soft-delete + audit are atomic
  await db.$transaction(async (tx) => {
    await tx.item.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await tx.transaction.create({
      data: {
        itemId: id,
        action: "delete",
        personId: session.user.id,
        note: `Soft-deleted ${existing.code}`,
      },
    });
  });

  return NextResponse.json({ ok: true, id });
}
