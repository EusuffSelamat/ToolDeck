import { db } from "@/lib/db";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

// ── Constants ────────────────────────────────────────────────────────────
export const TRACKING_TYPES = ["asset", "stock"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const ITEM_STATUSES = [
  "available",
  "checked_out",
  "needs_service",
  "out_of_order",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CONDITIONS = ["good", "needs_service", "out_of_order"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const TXN_ACTIONS = [
  "add",
  "checkout",
  "checkin",
  "move",
  "adjust_qty",
  "condition",
  "edit",
  "delete",
  "restore",
  "maintenance",
] as const;
export type TxnAction = (typeof TXN_ACTIONS)[number];

export const PHOTOS_DIR = path.join(process.cwd(), "public", "item-photos");

// ── Zod schemas (API-layer validation — SQLite has no enums) ─────────────
export const itemCreateSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serialNo: z.string().max(100).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  trackingType: z.enum(TRACKING_TYPES),
  quantity: z.number().min(0).default(1),
  minQuantity: z.number().min(0).default(0),
  condition: z.enum(CONDITIONS).default("good"),
  homeLocationId: z.string().optional().nullable(),
  currentLocationId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  photoBase64: z.string().optional(),
});

export const itemUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serialNo: z.string().max(100).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  // trackingType is immutable after creation
  status: z.enum(ITEM_STATUSES).optional(),
  quantity: z.number().min(0).optional(),
  minQuantity: z.number().min(0).optional(),
  condition: z.enum(CONDITIONS).optional(),
  homeLocationId: z.string().optional().nullable(),
  currentLocationId: z.string().optional().nullable(),
  holderId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  photoBase64: z.string().optional(),
});

// ── Code assignment (replaces Postgres sequences) ───────────────────────
// Called within a Prisma $transaction for safety. At ≤2000-item scale the
// read-then-write race is negligible; the transaction adds a safety net.
export async function nextItemCode(trackingType: TrackingType): Promise<string> {
  const prefix = trackingType === "asset" ? "AST" : "STK";
  const items = await db.item.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });
  const maxNum = items.reduce((max, item) => {
    const num = parseInt(item.code.split("-")[1] || "0", 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(4, "0")}`;
}

// ── Photo save (replaces Supabase Storage bucket) ───────────────────────
// Receives a compressed base64 JPEG (client compresses to max-edge 1280px,
// quality 0.8 before sending). Saves to public/item-photos/{code}.jpg.
// Returns the publicly accessible URL path.
export async function savePhoto(
  code: string,
  base64: string
): Promise<string> {
  // Strip data URL prefix if present
  const clean = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(clean, "base64");

  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  const filename = `${code}.jpg`;
  await fs.writeFile(path.join(PHOTOS_DIR, filename), buffer);

  return `/item-photos/${filename}`;
}

// ── Types for API responses ─────────────────────────────────────────────
export type ItemListItem = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  trackingType: TrackingType;
  status: ItemStatus;
  condition: Condition;
  quantity: number;
  minQuantity: number;
  photoUrl: string | null;
  categoryName: string | null;
  currentLocationName: string | null;
  homeLocationName: string | null;
  holderName: string | null;
  updatedAt: Date;
};

export type ItemDetail = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  categoryId: string | null;
  categoryName: string | null;
  trackingType: TrackingType;
  status: ItemStatus;
  condition: Condition;
  quantity: number;
  minQuantity: number;
  homeLocationId: string | null;
  homeLocationName: string | null;
  currentLocationId: string | null;
  currentLocationName: string | null;
  holderId: string | null;
  holderName: string | null;
  photoUrl: string | null;
  aiConfidence: number | null;
  notes: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  transactions: TxnListItem[];
};

export type TxnListItem = {
  id: string;
  action: TxnAction;
  qtyDelta: number | null;
  note: string | null;
  createdAt: Date;
  personName: string | null;
  holderName: string | null;
  fromLocationName: string | null;
  toLocationName: string | null;
};
