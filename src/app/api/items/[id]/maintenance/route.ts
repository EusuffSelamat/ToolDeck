import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

// GET /api/items/[id]/maintenance — list maintenance logs for an item
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const logs = await db.maintenanceLog.findMany({
    where: { itemId: id },
    orderBy: { doneAt: "desc" },
    include: {
      createdByUser: { select: { fullName: true } },
    },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      doneAt: l.doneAt,
      description: l.description,
      cost: l.cost,
      nextDue: l.nextDue,
      createdByName: l.createdByUser?.fullName ?? null,
      createdAt: l.createdAt,
    })),
  });
}

const dateString = z.string().refine(
  (v) => !isNaN(Date.parse(v)),
  "Invalid date"
);

const createSchema = z.object({
  description: z.string().min(1).max(500),
  doneAt: dateString.optional(),
  cost: z.number().min(0).optional().nullable(),
  nextDue: dateString.optional().nullable(),
});

// POST /api/items/[id]/maintenance — add a maintenance log entry
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
  const parsed = createSchema.safeParse(body);
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

  // Transaction: create maintenance log + write 'maintenance' audit transaction
  const log = await db.$transaction(async (tx) => {
    const created = await tx.maintenanceLog.create({
      data: {
        itemId: id,
        description: data.description.trim(),
        doneAt: data.doneAt ? new Date(data.doneAt) : new Date(),
        cost: data.cost ?? null,
        nextDue: data.nextDue ? new Date(data.nextDue) : null,
        createdBy: session.user.id,
      },
    });

    // If nextDue is set within 14 days, update item condition to needs_service
    if (data.nextDue) {
      const nextDue = new Date(data.nextDue);
      const fourteenDays = new Date(Date.now() + 14 * 86400000);
      if (nextDue <= fourteenDays && existing.condition !== "out_of_order") {
        await tx.item.update({
          where: { id },
          data: { condition: "needs_service", status: "needs_service" },
        });
      }
    }

    await tx.transaction.create({
      data: {
        itemId: id,
        action: "maintenance",
        personId: session.user.id,
        note: data.description.trim().slice(0, 200),
      },
    });

    return created;
  });

  return NextResponse.json({ log: { id: log.id } }, { status: 201 });
}
