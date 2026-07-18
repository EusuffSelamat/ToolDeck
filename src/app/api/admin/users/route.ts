import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-auth";

// GET /api/admin/users?status=pending
// Admin-only. Lists user accounts, optionally filtered by approval status.
// Used by the dashboard "Pending approvals" panel.
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // 'pending' | 'approved' | 'rejected' | null

  const where =
    status === "pending" || status === "approved" || status === "rejected"
      ? { approvalStatus: status }
      : {};

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      approvalStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}
