import { NextResponse } from "next/server";
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

  const existing = await db.user.findUnique({ where: { email: lower } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.create({ data: { email: lower, fullName: name.trim(), passwordHash } });

  return NextResponse.json({ ok: true });
}
