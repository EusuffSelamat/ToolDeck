import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  sort: z.number().optional(),
});

// PATCH /api/categories/[id] — rename or reorder
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only admins can manage categories
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

  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.sort !== undefined) data.sort = parsed.data.sort;

  try {
    const category = await db.category.update({ where: { id }, data });
    return NextResponse.json({ category });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A category with that name already exists." },
        { status: 409 }
      );
    }
    console.error("Category update failed:", e);
    return NextResponse.json({ error: "Could not update category." }, { status: 500 });
  }
}

// DELETE /api/categories/[id] — hard delete, but blocks if items use it
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only admins can manage categories
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await params;

  const existing = await db.category.findUnique({
    where: { id },
    include: {
      _count: { select: { items: { where: { isDeleted: false } } } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing._count.items > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${existing._count.items} item(s) use this category. Reassign them first.`,
      },
      { status: 409 }
    );
  }

  try {
    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Category delete failed:", e);
    return NextResponse.json({ error: "Could not delete category." }, { status: 500 });
  }
}
