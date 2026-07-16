import { db } from "@/lib/db";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

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

/** Soft-delete restore window — re-exported from client-safe constants. */
export { RESTORE_WINDOW_MS } from "@/lib/constants";

/** Max base64 photo size (~1.5MB decoded, matches compressed JPEG budget). */
export const MAX_PHOTO_BASE64_LEN = 2_000_000;

// ── Zod schemas (API-layer validation — SQLite has no enums) ─────────────
export const itemCreateSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  serialNo: z.string().max(100).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  trackingType: z.enum(TRACKING_TYPES),
  quantity: z.number().min(0).default(1),
  condition: z.enum(CONDITIONS).default("good"),
  homeLocationId: z.string().optional().nullable(),
  currentLocationId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  photoBase64: z.string().max(MAX_PHOTO_BASE64_LEN).optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
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
  condition: z.enum(CONDITIONS).optional(),
  homeLocationId: z.string().optional().nullable(),
  currentLocationId: z.string().optional().nullable(),
  holderId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  photoBase64: z.string().max(MAX_PHOTO_BASE64_LEN).optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
});

// ── Code assignment (replaces Postgres sequences) ───────────────────────
// Reads the max existing code number for the prefix and increments.
// Callers MUST wrap the create in a transaction and retry on P2002.
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
// Writes to a temp file first, then renames atomically. If the DB create
// fails, the temp file is cleaned up. Validates JPEG magic bytes.
// Returns the publicly accessible URL path, or throws on failure.
export async function savePhoto(
  code: string,
  base64: string
): Promise<string> {
  // Strip data URL prefix if present
  const clean = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(clean, "base64");

  // Validate JPEG magic bytes (FF D8 FF)
  if (
    buffer.length < 3 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[2] !== 0xff
  ) {
    throw new Error("Invalid JPEG data");
  }

  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  const filename = `${code}.jpg`;
  const finalPath = path.join(PHOTOS_DIR, filename);
  const tempPath = path.join(PHOTOS_DIR, `${code}.tmp.${randomBytes(4).toString("hex")}.jpg`);

  // Write to temp, then rename atomically
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, finalPath);

  return `/item-photos/${filename}`;
}

/** Delete a photo file. Safe to call if the file doesn't exist. */
export async function deletePhoto(photoUrl: string | null): Promise<void> {
  if (!photoUrl) return;
  const filename = path.basename(photoUrl);
  const filepath = path.join(PHOTOS_DIR, filename);
  try {
    await fs.unlink(filepath);
  } catch {
    // File doesn't exist or already deleted — fine
  }
}

/** Check if a soft-deleted item is still within the restore window. */
export function isRestorable(deletedAt: Date | null): boolean {
  if (!deletedAt) return false;
  return Date.now() - deletedAt.getTime() <= RESTORE_WINDOW_MS;
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
  photoUrl: string | null;
  categoryName: string | null;
  homeLocationId: string | null;
  currentLocationId: string | null;
  currentLocationName: string | null;
  homeLocationName: string | null;
  holderId: string | null;
  holderName: string | null;
  expectedReturnDate?: Date | null;
  updatedAt: Date;
  deletedAt?: Date | null;
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
  homeLocationId: string | null;
  homeLocationName: string | null;
  currentLocationId: string | null;
  currentLocationName: string | null;
  holderId: string | null;
  holderName: string | null;
  expectedReturnDate: Date | null;
  photoUrl: string | null;
  aiConfidence: number | null;
  notes: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
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
