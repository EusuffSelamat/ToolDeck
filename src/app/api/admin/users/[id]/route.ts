import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-auth";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

// PATCH /api/admin/users/[id]
// Admin-only. Approve or reject a pending account.
// Body: { action: "approve" | "reject" }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action. Expected 'approve' or 'reject'." },
      { status: 400 }
    );
  }

  // Guard: an admin cannot change their own approval status.
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own account status." },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const approvalStatus = parsed.data.action === "approve" ? "approved" : "rejected";

  const updated = await db.user.update({
    where: { id },
    data: { approvalStatus },
    select: { id: true, fullName: true, email: true, approvalStatus: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}
