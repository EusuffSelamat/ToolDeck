// TOOLDECK — M2 seed script.
// Seeds the §14 category tree and one demo location.
// Idempotent: safe to run repeatedly (upserts by unique key).
//
// Run: bun run scripts/seed.ts

import { db } from "../src/lib/db";

// §14 — Seed category tree (fully editable in Settings later)
const CATEGORIES = [
  "Power Tools",
  "Hand Tools",
  "Machinery & Plant",
  "Welding & Fabrication",
  "Measuring & Testing",
  "Lifting & Rigging",
  "Electrical & Cabling",
  "Air & Pneumatic",
  "Safety & PPE",
  "Consumables & Fasteners",
  "Vehicles & Transport",
  "Other",
];

// One demo location (§11 M2: "seed … one demo location")
const DEMO_LOCATION = { name: "Main Workshop", kind: "site" };

async function main() {
  console.log("Seeding TOOLDECK…\n");

  // Categories — upsert by name (unique)
  for (let i = 0; i < CATEGORIES.length; i++) {
    await db.category.upsert({
      where: { name: CATEGORIES[i] },
      update: { sort: i },
      create: { name: CATEGORIES[i], sort: i },
    });
  }
  const catCount = await db.category.count();
  console.log(`  ✓ ${catCount} categories seeded (${CATEGORIES.length} expected)`);

  // Demo location — upsert by name
  const existing = await db.location.findFirst({ where: { name: DEMO_LOCATION.name } });
  if (existing) {
    await db.location.update({ where: { id: existing.id }, data: { kind: DEMO_LOCATION.kind } });
    console.log(`  ✓ Demo location already exists: "${DEMO_LOCATION.name}" (id: ${existing.id})`);
  } else {
    const loc = await db.location.create({ data: DEMO_LOCATION });
    console.log(`  ✓ Demo location created: "${loc.name}" (id: ${loc.id})`);
  }

  const locCount = await db.location.count();
  console.log(`  ✓ ${locCount} location(s) total\n`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
