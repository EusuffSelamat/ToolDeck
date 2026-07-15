import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { z } from "zod";

// GET /api/locations — list all locations with:
//   - itemCount: items currently at this location
//   - homeItemCount: items whose home is this location
//   - awayItems: items whose home is here but are currently elsewhere
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await db.location.findMany({
    orderBy: { name: "asc" },
    include: {
      itemsCurrent: {
        where: { isDeleted: false },
        select: {
          id: true,
          categoryId: true,
          category: { select: { name: true } },
          trackingType: true,
        },
      },
      itemsHome: {
        where: { isDeleted: false },
        select: {
          id: true,
          code: true,
          name: true,
          photoUrl: true,
          status: true,
          holderId: true,
          holder: { select: { fullName: true } },
          homeLocationId: true,
          currentLocationId: true,
          currentLocation: { select: { name: true } },
        },
      },
    },
  });

  const result = locations.map((loc) => {
    const currentItems = loc.itemsCurrent;
    const homeItems = loc.itemsHome;

    // Items whose home is here but are currently elsewhere (or checked out)
    const awayItems = homeItems.filter(
      (item) => item.currentLocationId !== loc.id || item.holderId
    );

    // Group away items by where they are now
    const awaySummary: Record<string, number> = {};
    for (const item of awayItems) {
      let key: string;
      if (item.holderId && item.holder?.fullName) {
        key = `Checked out · ${item.holder.fullName}`;
      } else if (item.currentLocation?.name) {
        key = item.currentLocation.name;
      } else {
        key = "Unknown location";
      }
      awaySummary[key] = (awaySummary[key] ?? 0) + 1;
    }

    const awayBreakdown = Object.entries(awaySummary)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    // Category breakdown for items currently here
    const categoryBreakdown: Record<string, number> = {};
    for (const item of currentItems) {
      const cat = item.category?.name ?? "Uncategorised";
      categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1;
    }

    const topCategories = Object.entries(categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      id: loc.id,
      name: loc.name,
      kind: loc.kind,
      itemCount: currentItems.length,
      homeItemCount: homeItems.length,
      awayCount: awayItems.length,
      awayBreakdown,
      topCategories,
    };
  });

  return NextResponse.json({ locations: result });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(["site", "room", "vehicle"]).default("site"),
});

// POST /api/locations — create a new location.
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, kind } = parsed.data;

  try {
    const location = await db.location.create({
      data: { name: name.trim(), kind },
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A location with that name already exists." },
        { status: 409 }
      );
    }
    console.error("Location create failed:", e);
    return NextResponse.json(
      { error: "Could not create location." },
      { status: 500 }
    );
  }
}
