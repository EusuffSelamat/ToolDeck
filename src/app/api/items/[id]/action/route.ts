import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canManage, canOperate } from "@/lib/roles";
import { z } from "zod";

/**
 * POST /api/items/[id]/action — perform a custody/stock action.
 *
 * Actions (§7.3–7.6):
 *   - checkout:   holder (defaults to actor), destination location, expectedReturnDate?, note?
 *                 → status=checked_out, holder set, currentLocation set
 *   - checkin:    note?
 *                 → status=available, holder cleared, currentLocation=homeLocation, expectedReturnDate cleared
 *   - move:       toLocationId, note?
 *                 → currentLocation set
 *   - adjust_qty: delta (number), reason (used|restocked|counted|damaged), note?
 *                 → quantity += delta (clamped to 0)
 *   - condition:  condition (good|needs_service|out_of_order), note?
 *                 → condition + status updated
 *
 * Every action writes a Transaction row with the full context (from/to, holder, qty delta, note).
 */

const actionSchema = z.object({
  action: z.enum(["checkout", "checkin", "move", "adjust_qty", "condition"]),

  // checkout
  holderId: z.string().optional().nullable(),
  toLocationId: z.string().optional().nullable(),
  expectedReturnDate: z.string().optional().nullable(), // ISO date string

  // adjust_qty
  delta: z.number().optional(),
  reason: z.enum(["used", "restocked", "counted", "damaged"]).optional(),

  // condition
  condition: z.enum(["good", "needs_service", "out_of_order"]).optional(),

  // all
  note: z.string().max(500).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Viewers are read-only: no actions at all. Workers can only:
  // checkout, checkin, move. Managers/admins can do all 6.
  if (!canOperate(session.user.role)) {
    return NextResponse.json(
      { error: "Your account is view-only. Ask an admin for access." },
      { status: 403 }
    );
  }
  if (!canManage(session.user.role)) {
    const allowed = ["checkout", "checkin", "move"];
    if (!allowed.includes(data.action)) {
      return NextResponse.json(
        { error: "Manager access required for this action." },
        { status: 403 }
      );
    }
  }

  const existing = await db.item.findUnique({
    where: { id },
    include: {
      holder: { select: { fullName: true } },
      homeLocation: { select: { id: true, name: true } },
      currentLocation: { select: { id: true, name: true } },
    },
  });

  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build the update + transaction data based on the action
  let updateData: Record<string, unknown> = {};
  let txnData: Record<string, unknown> = {
    itemId: id,
    personId: session.user.id,
    action: data.action,
  };

  switch (data.action) {
    case "checkout": {
      if (existing.trackingType !== "asset") {
        return NextResponse.json(
          { error: "Only unique assets can be checked out." },
          { status: 400 }
        );
      }
      const holderId = data.holderId || session.user.id;
      const toLocationId = data.toLocationId || existing.currentLocationId;
      const expectedReturnDate = data.expectedReturnDate
        ? new Date(data.expectedReturnDate)
        : null;

      updateData = {
        status: "checked_out",
        holderId,
        currentLocationId: toLocationId,
        expectedReturnDate,
      };

      txnData.holderId = holderId;
      txnData.toLocationId = toLocationId ?? null;
      txnData.fromLocationId = existing.currentLocationId ?? null;
      txnData.note = data.note || `Checked out${expectedReturnDate ? ` · expected back ${expectedReturnDate.toLocaleDateString("en-SG")}` : ""}`;
      break;
    }

    case "checkin": {
      if (existing.status !== "checked_out") {
        return NextResponse.json(
          { error: "This item is not checked out." },
          { status: 400 }
        );
      }
      // Return: status=available, holder cleared, location resets to home
      updateData = {
        status: "available",
        holderId: null,
        currentLocationId: existing.homeLocationId ?? null,
        expectedReturnDate: null,
      };

      txnData.fromLocationId = existing.currentLocationId ?? null;
      txnData.toLocationId = existing.homeLocationId ?? null;
      txnData.note = data.note || `Returned${existing.holder ? ` from ${existing.holder.fullName}` : ""}`;
      break;
    }

    case "move": {
      if (!data.toLocationId) {
        return NextResponse.json(
          { error: "Destination location is required." },
          { status: 400 }
        );
      }
      updateData = {
        currentLocationId: data.toLocationId,
      };

      txnData.fromLocationId = existing.currentLocationId ?? null;
      txnData.toLocationId = data.toLocationId;
      txnData.note = data.note || null;
      break;
    }

    case "adjust_qty": {
      if (existing.trackingType !== "stock") {
        return NextResponse.json(
          { error: "Quantity can only be adjusted for stock items." },
          { status: 400 }
        );
      }
      if (typeof data.delta !== "number" || data.delta === 0) {
        return NextResponse.json(
          { error: "A non-zero quantity delta is required." },
          { status: 400 }
        );
      }
      const newQty = Math.max(0, existing.quantity + data.delta);
      const actualDelta = newQty - existing.quantity;

      updateData = { quantity: newQty };
      txnData.qtyDelta = actualDelta;
      txnData.note = data.note || `Quantity ${data.reason || "adjusted"} (${actualDelta > 0 ? "+" : ""}${actualDelta})`;
      break;
    }

    case "condition": {
      if (!data.condition) {
        return NextResponse.json(
          { error: "Condition is required." },
          { status: 400 }
        );
      }
      // Reject condition change to needs_service/out_of_order while checked out
      // — the item must be returned first to avoid an inconsistent state
      if (
        existing.status === "checked_out" &&
        (data.condition === "needs_service" || data.condition === "out_of_order")
      ) {
        return NextResponse.json(
          { error: "Return this item before marking it as needs service or out of order." },
          { status: 400 }
        );
      }
      // Map condition to status: needs_service → needs_service, out_of_order → out_of_order, good → available
      const newStatus =
        data.condition === "needs_service"
          ? "needs_service"
          : data.condition === "out_of_order"
          ? "out_of_order"
          : existing.status === "checked_out"
          ? "checked_out"
          : "available";

      updateData = {
        condition: data.condition,
        status: newStatus,
      };

      txnData.note = data.note || `Condition set to ${data.condition.replace(/_/g, " ")}`;
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Execute atomically
  try {
    await db.$transaction(async (tx) => {
      await tx.item.update({ where: { id }, data: updateData });
      // txnData is built dynamically per action; it always carries the
      // required itemId/personId/action fields set above.
      await tx.transaction.create({
        data: txnData as unknown as Prisma.TransactionUncheckedCreateInput,
      });
    });
  } catch (e) {
    console.error("Action failed:", e);
    return NextResponse.json(
      { error: "Could not perform action. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id, action: data.action });
}
