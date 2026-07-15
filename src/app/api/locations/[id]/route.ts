import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  kind: z.enum(["site", "room", "vehicle"]).optional(),
});

// PATCH /api/locations/[id] — rename or change kind.
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const existing = await db.location.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.kind !== undefined) data.kind = parsed.data.kind;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ location: { id }, unchanged: true });
  }

  try {
    const location = await db.location.update({ where: { id }, data });
    return NextResponse.json({ location });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A location with that name already exists." },
        { status: 409 }
      );
    }
    console.error("Location update failed:", e);
    return NextResponse.json(
      { error: "Could not update location." },
      { status: 500 }
    );
  }
}

// DELETE /api/locations/[id] — hard delete, but only if no items reference it.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.location.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          itemsHome: { where: { isDeleted: false } },
          itemsCurrent: { where: { isDeleted: false } },
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inUse = existing._count.itemsHome + existing._count.itemsCurrent;
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${inUse} item(s) are currently at or call this location home. Move or reassign them first.`,
      },
      { status: 409 }
    );
  }

  try {
    await db.location.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Location delete failed:", e);
    return NextResponse.json(
      { error: "Could not delete location." },
      { status: 500 }
    );
  }
}
