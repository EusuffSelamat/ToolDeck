import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

// POST /api/signup — create a new account.
// Returns { ok: true } on success, or { error } with a 4xx on failure.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a name, a valid email, and a password of at least 6 characters." },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;
  const lower = email.toLowerCase().trim();

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // New accounts start as 'pending' (schema default) — an admin must
    // approve them from the dashboard before they can sign in.
    await db.user.create({
      data: { email: lower, fullName: name.trim(), passwordHash },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    console.error("Signup failed:", e);
    return NextResponse.json(
      { error: "Could not create account. Please try again." },
      { status: 500 }
    );
  }

  // pending: true tells the client to show an "awaiting approval" message
  // and NOT attempt to auto sign-in (which would fail the approval gate).
  return NextResponse.json({ ok: true, pending: true });
}
