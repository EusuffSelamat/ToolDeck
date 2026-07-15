import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

// GET /api/meta — returns categories + locations for the signed-in user.
// Auth-gated: anonymous requests get 401 (the RLS equivalent).
// Used by the Items form (category/location pickers), Locations view, and
// Settings. Also serves as the M2 verification endpoint.
export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [categories, locations] = await Promise.all([
    db.category.findMany({
      orderBy: { sort: "asc" },
      select: { id: true, name: true, sort: true },
    }),
    db.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
  ]);

  return NextResponse.json({ categories, locations });
}
