import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-auth";

const schema = z.union([
  z.object({ action: z.enum(["approve", "reject"]) }),
  z.object({ action: z.literal("set_role"), role: z.enum(["viewer", "worker", "manager"]) }),
]);

// PATCH /api/admin/users/[id]
// Admin-only. Approve/reject a pending account, or change a user's role.
// Body: { action: "approve" | "reject" }
//   or: { action: "set_role", role: "worker" | "manager" }
// Admin accounts cannot be modified through this endpoint (provisioned
// manually), and an admin can never modify their own account.
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
      { error: "Invalid action. Expected 'approve', 'reject', or 'set_role' with a role." },
      { status: 400 }
    );
  }

  // Guard: an admin cannot change their own account.
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own account." },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Guard: admin accounts are managed manually, never via this endpoint —
  // prevents one admin demoting/locking out another.
  if (target.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot be modified here." },
      { status: 403 }
    );
  }

  const data =
    parsed.data.action === "set_role"
      ? { role: parsed.data.role }
      : { approvalStatus: parsed.data.action === "approve" ? "approved" : "rejected" };

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, fullName: true, email: true, role: true, approvalStatus: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}

// DELETE /api/admin/users/[id]
// Admin-only. Permanently delete an account. Same guards as PATCH: never
// self, never another admin. Blocked while the user still holds checked-out
// items (they must be returned first, or the items would be left in a
// checked-out state with no holder). Audit-trail rows survive — the User
// foreign keys are optional and null out on delete (Prisma SetNull default).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({
    where: { id },
    select: {
      role: true,
      fullName: true,
      _count: { select: { heldItems: { where: { isDeleted: false } } } },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted here." },
      { status: 403 }
    );
  }
  if (target._count.heldItems > 0) {
    return NextResponse.json(
      {
        error: `${target.fullName} still holds ${target._count.heldItems} checked-out item(s). Return them first.`,
      },
      { status: 409 }
    );
  }

  await db.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
