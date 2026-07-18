import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canManage } from "@/lib/roles";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(50),
});

// POST /api/categories — create a new category
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only managers/admins can manage categories
  if (!canManage(session.user.role)) {
    return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Get the max sort value
  const maxSort = await db.category.aggregate({ _max: { sort: true } });

  try {
    const category = await db.category.create({
      data: {
        name: parsed.data.name.trim(),
        sort: (maxSort._max.sort ?? -1) + 1,
      },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A category with that name already exists." },
        { status: 409 }
      );
    }
    console.error("Category create failed:", e);
    return NextResponse.json({ error: "Could not create category." }, { status: 500 });
  }
}
