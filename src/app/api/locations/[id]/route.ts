import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";
import { isAncestor } from "@/lib/locations";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  kind: z.enum(["site", "room", "vehicle"]).optional(),
  parentLocationId: z.string().nullable().optional(),
});

// PATCH /api/locations/[id] — rename, change kind, or move to a new parent.
// Prevents self-reference and circular hierarchies.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only admins can manage locations
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
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

  // Validate parentLocationId: prevent self-reference + cycles
  if (parsed.data.parentLocationId !== undefined) {
    const newParentId = parsed.data.parentLocationId || null;

    if (newParentId === id) {
      return NextResponse.json(
        { error: "A location cannot be its own parent." },
        { status: 400 }
      );
    }

    if (newParentId) {
      // Check the proposed parent exists
      const parent = await db.location.findUnique({ where: { id: newParentId } });
      if (!parent) {
        return NextResponse.json(
          { error: "The selected parent location does not exist." },
          { status: 400 }
        );
      }

      // Walk up the proposed parent's chain — if we hit `id`, it's a cycle
      const wouldCycle = await isAncestor(newParentId, id);
      if (wouldCycle) {
        return NextResponse.json(
          { error: "Circular location hierarchy — pick a different parent." },
          { status: 400 }
        );
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.kind !== undefined) data.kind = parsed.data.kind;
  if (parsed.data.parentLocationId !== undefined) {
    data.parentLocationId = parsed.data.parentLocationId || null;
  }

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

// DELETE /api/locations/[id] — hard delete, but blocks if items reference it
// OR if child locations are nested under it.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only admins can manage locations
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.location.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          itemsHome: { where: { isDeleted: false } },
          itemsCurrent: { where: { isDeleted: false } },
          children: true,
          txFrom: true,
          txTo: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Block if transactions reference this location (audit trail integrity)
  const txCount = existing._count.txFrom + existing._count.txTo;
  if (txCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${txCount} transaction(s) reference this location in the audit trail. Rename it instead.`,
      },
      { status: 409 }
    );
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

  if (existing._count.children > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${existing._count.children} child location(s) are nested under this one. Reassign or delete them first.`,
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
