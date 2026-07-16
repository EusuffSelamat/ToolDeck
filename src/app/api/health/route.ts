// ==============================================================
// TEMPORARY diagnostic endpoint — save as:
//    src/app/api/health/route.ts
// Deploy, open https://tool-deck-two.vercel.app/api/health,
// and it will tell you exactly which link in the chain is broken.
// DELETE THIS FILE once login works (it leaks table names / counts).
//
// Adjust the import below to match your Prisma client export —
// in this template it's usually `import { db } from "@/lib/db"`,
// in others `import { prisma } from "@/lib/prisma"`.
// ==============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs"; // Prisma cannot run on the edge runtime
export const dynamic = "force-dynamic";

export async function GET() {
  const report: Record<string, unknown> = {
    env: {
      DATABASE_URL: maskDbUrl(process.env.DATABASE_URL),
      DIRECT_URL: maskDbUrl(process.env.DIRECT_URL),
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(NOT SET)",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "(NOT SET)",
      runningOnVercel: Boolean(process.env.VERCEL),
    },
  };

  // 1. Can we reach the database at all?
  try {
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    report.dbConnection = { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    report.dbConnection = { ok: false, error: describe(err) };
    return NextResponse.json(report, { status: 500 });
  }

  // 2. Do the tables Prisma expects actually exist (exact casing)?
  try {
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`;
    report.tablesInSupabase = rows.map((r) => r.table_name);
  } catch (err) {
    report.tablesInSupabase = { error: describe(err) };
  }

  // 3. Can Prisma query the User model? (rename if your model differs)
  try {
    report.userCount = await db.user.count();
  } catch (err) {
    report.userCount = { error: describe(err) };
  }

  return NextResponse.json(report);
}

// Shows host/port/query params (the diagnostic gold) but hides the password.
function maskDbUrl(raw?: string) {
  if (!raw) return "(NOT SET)";
  try {
    const u = new URL(raw);
    const port = u.port || "(default)";
    return `${u.protocol}//${u.username || "?"}:***@${u.hostname}:${port}${u.pathname}${u.search}`;
  } catch {
    return "(set, but not parseable as a URL — check quoting/encoding)";
  }
}

function describe(err: unknown) {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
