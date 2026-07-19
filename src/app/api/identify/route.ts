import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { canOperate } from "@/lib/roles";

/**
 * POST /api/identify — AI vision identification endpoint (§6).
 *
 * Performance: optimized for 100+ rapid shots:
 * - Category list cached at module level (changes rarely)
 * - Dedupe: single DB query for ALL items, then in-memory trigram match
 * - Vision call wrapped in a 30s timeout (prevents hung requests)
 * - One retry on transient failure with exponential backoff
 */

// ── Types ────────────────────────────────────────────────────────────────
type IdentifiedItem = {
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  tracking_type: "asset" | "stock";
  condition_guess: "good" | "needs_service" | "out_of_order" | "unknown";
  estimated_quantity: number | null;
  description: string;
  identifying_features: string[];
  confidence: number;
};

type MatchCandidate = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  photoUrl: string | null;
  status: string;
  similarity: number;
};

// ── Category cache (avoids a DB query on every identify call) ────────────
let categoryCache: { list: string; expiry: number } | null = null;
const CATEGORY_CACHE_TTL = 60_000; // 1 minute

async function getCategoryList(): Promise<string> {
  const now = Date.now();
  if (categoryCache && now < categoryCache.expiry) {
    return categoryCache.list;
  }
  const categories = await db.category.findMany({
    orderBy: { sort: "asc" },
    select: { name: true },
  });
  const list = categories.map((c) => c.name).join(", ");
  categoryCache = { list, expiry: now + CATEGORY_CACHE_TTL };
  return list;
}

// ── Trigram similarity (replaces pg_trgm) ───────────────────────────────
function trigramSet(s: string): Set<string> {
  const set = new Set<string>();
  const padded = `  ${s}  `.toLowerCase();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

function trigramSimilarity(a: string, b: string): number {
  const sa = trigramSet(a);
  const sb = trigramSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  return intersection / (sa.size + sb.size - intersection);
}

// ── Dedupe — single DB query, in-memory matching for all candidates ─────
// Loads all non-deleted items once, then computes trigram similarity against
// each candidate string. At ≤2000 items this is <10ms per candidate.
async function findAllMatches(
  candidates: string[]
): Promise<MatchCandidate[][]> {
  if (candidates.length === 0) return [];

  const items = await db.item.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      code: true,
      name: true,
      brand: true,
      model: true,
      photoUrl: true,
      status: true,
    },
    orderBy: { code: "asc" },
    take: 2000,
  });

  // Pre-compute trigram sets for all existing items (do this once)
  const itemData = items.map((item) => ({
    ...item,
    itemText: `${item.name} ${item.brand ?? ""} ${item.model ?? ""}`.toLowerCase(),
  }));

  // For each candidate, compute similarity against all items
  return candidates.map((candidate) => {
    const candidateText = candidate.toLowerCase();
    return itemData
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        brand: item.brand,
        model: item.model,
        photoUrl: item.photoUrl,
        status: item.status,
        similarity: trigramSimilarity(candidateText, item.itemText),
      }))
      .filter((m) => m.similarity > 0.45)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  });
}

// ── API handler ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Scan/identify is an operational feature — hidden from viewers.
  if (!canOperate(session.user.role)) {
    return NextResponse.json(
      { error: "Your account is view-only. Ask an admin for access." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.imageBase64 !== "string") {
    return NextResponse.json(
      { error: "Image data required." },
      { status: 400 }
    );
  }

  const imageBase64: string = body.imageBase64;
  const maxLen = 2_000_000;
  if (imageBase64.length > maxLen) {
    return NextResponse.json(
      { error: "Image too large. Please use a smaller photo." },
      { status: 413 }
    );
  }

  const categoryList = await getCategoryList();
  const systemPrompt = buildSystemPrompt(categoryList);

  // Call the vision model with retry + timeout
  let rawResponse: string;
  try {
    rawResponse = await callVisionModelWithRetry(imageBase64, systemPrompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Vision model call failed:", msg);

    // Return a user-friendly error with the specific failure reason.
    // `detail` surfaces the underlying cause (config/model/API errors) so it
    // can be diagnosed from the client without digging through server logs.
    if (msg.includes("timeout") || msg.includes("Timeout")) {
      return NextResponse.json(
        { error: "The AI took too long to respond. Please try again.", detail: msg },
        { status: 504 }
      );
    }
    return NextResponse.json(
      {
        error: "Could not analyse the photo. Please try again or add manually.",
        detail: msg,
      },
      { status: 502 }
    );
  }

  // Parse the JSON response (with one repair retry per §6)
  let parsedItems: IdentifiedItem[];
  let multiItem: boolean;

  try {
    const result = parseVisionResponse(rawResponse);
    parsedItems = result.items;
    multiItem = result.multi_item;
  } catch {
    // Retry once with a repair instruction
    try {
      const repaired = await callVisionModelWithRetry(
        imageBase64,
        "Your last reply was not valid JSON. Re-emit only the JSON object.",
        1 // no further retries on repair
      );
      const result = parseVisionResponse(repaired);
      parsedItems = result.items;
      multiItem = result.multi_item;
    } catch {
      // Treat as confidence 0 — open manual form
      parsedItems = [
        {
          name: "Unknown item",
          brand: null,
          model: null,
          category: "Other",
          tracking_type: "asset",
          condition_guess: "unknown",
          estimated_quantity: null,
          description: "Could not identify this item.",
          identifying_features: [],
          confidence: 0,
        },
      ];
      multiItem = false;
    }
  }

  // Run dedupe for all identified items in a single DB query
  const candidateStrings = parsedItems.map(
    (item) => `${item.name} ${item.brand ?? ""} ${item.model ?? ""}`
  );
  const allMatches = await findAllMatches(candidateStrings);

  const itemsWithMatches = parsedItems.map((item, i) => ({
    ...item,
    matches: allMatches[i] ?? [],
  }));

  return NextResponse.json({
    multi_item: multiItem,
    items: itemsWithMatches,
  });
}

// ── System prompt (§6, extended for multi-item photos) ──────────────────
function buildSystemPrompt(categoryList: string): string {
  return `You are the recognition engine of a tools & machinery inventory app.
You receive one photo. The photo may contain a SINGLE tool/machine, OR a
BOX/CRATE/SHELF containing MULTIPLE items. Reply with ONLY minified JSON —
no markdown, no commentary — matching exactly this shape:

{
  "multi_item": boolean,
  "items": [
    {
      "name": string,
      "brand": string|null,
      "model": string|null,
      "category": string,
      "tracking_type": "asset"|"stock",
      "condition_guess": "good"|"needs_service"|"out_of_order"|"unknown",
      "estimated_quantity": number|null,
      "description": string,
      "identifying_features": [string],
      "confidence": number
    }
  ]
}

Rules:
- category MUST be exactly one of: ${categoryList}
- tracking_type: "asset" = unique serialised unit (machines, power tools);
  "stock" = counted small items (bits, blades, fasteners, PPE)
- confidence: 0.0–1.0, honest overall confidence
- If the photo clearly shows a single item, set multi_item=false and items
  has exactly one entry.
- If the photo shows multiple distinct items (a box, a shelf, a pile), set
  multi_item=true and list each identifiable item in the items array. For
  items you cannot identify, omit them — do NOT pad with low-confidence
  guesses.
- If the photo is not a tool/machine at all, or is completely
  unidentifiable, return multi_item=false with one item: name "Unknown
  item", category "Other", confidence ≤ 0.2.
- Never invent serial numbers or model codes you cannot actually read.
- estimated_quantity: only if the photo clearly shows multiple identical
  stock items (e.g. a box of 50 screws).
- identifying_features: up to 3 visible cues (colour, markings, wear).
- description: one plain-English sentence per item.`;
}

// ── Vision model call with retry + timeout ──────────────────────────────
const VISION_TIMEOUT_MS = 30_000; // 30s per attempt
const MAX_RETRIES = 2;

// Google Gemini vision model — free tier via a Google AI Studio API key.
// Override with a GEMINI_MODEL env var (e.g. "gemini-2.5-flash",
// "gemini-1.5-flash") without a code change.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

async function callVisionModelWithRetry(
  imageBase64: string,
  systemPrompt: string,
  maxRetries: number = MAX_RETRIES
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callVisionModel(imageBase64, systemPrompt);
    } catch (e) {
      lastError = e;
      // Don't retry on 4xx (client errors — bad image, etc.)
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("400") || msg.includes("413") || msg.includes("422")) {
        throw e;
      }
      // Exponential backoff: 500ms, 1000ms
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

async function callVisionModel(
  imageBase64: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Gemini wants raw base64 + an explicit mime type, so strip any data-URL prefix.
  let mimeType = "image/jpeg";
  let data = imageBase64;
  if (imageBase64.startsWith("data:")) {
    const comma = imageBase64.indexOf(",");
    if (comma !== -1) {
      mimeType = imageBase64.slice(5, comma).split(";")[0] || "image/jpeg";
      data = imageBase64.slice(comma + 1);
    }
  }

  // Wrap in a timeout — a hung request should fail fast, not block the route.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Identify the tool(s) in this photo. Reply with only the JSON object.",
                },
                { inlineData: { mimeType, data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // Include the status so callVisionModelWithRetry skips retries on 4xx.
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => p.text ?? "").join("")
      : "";
    if (!text) {
      const finishReason = json?.candidates?.[0]?.finishReason;
      const blockReason = json?.promptFeedback?.blockReason;
      throw new Error(
        `Gemini returned no content${finishReason ? ` (finish: ${finishReason})` : ""}${
          blockReason ? ` (blocked: ${blockReason})` : ""
        }`
      );
    }
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Vision model timeout");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Response parser ─────────────────────────────────────────────────────
function parseVisionResponse(raw: string): {
  multi_item: boolean;
  items: IdentifiedItem[];
} {
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```$/, "");
  }

  const data = JSON.parse(clean);

  if (data.items && Array.isArray(data.items)) {
    return {
      multi_item: Boolean(data.multi_item),
      items: data.items.map(normalizeItem),
    };
  }

  return {
    multi_item: false,
    items: [normalizeItem(data)],
  };
}

function normalizeItem(item: Record<string, unknown>): IdentifiedItem {
  return {
    name: String(item.name ?? "Unknown item"),
    brand: item.brand ? String(item.brand) : null,
    model: item.model ? String(item.model) : null,
    category: String(item.category ?? "Other"),
    tracking_type: item.tracking_type === "stock" ? "stock" : "asset",
    condition_guess:
      item.condition_guess === "good" ||
      item.condition_guess === "needs_service" ||
      item.condition_guess === "out_of_order" ||
      item.condition_guess === "unknown"
        ? item.condition_guess
        : "unknown",
    estimated_quantity:
      typeof item.estimated_quantity === "number"
        ? item.estimated_quantity
        : null,
    description: String(item.description ?? ""),
    identifying_features: Array.isArray(item.identifying_features)
      ? item.identifying_features.slice(0, 3).map(String)
      : [],
    confidence:
      typeof item.confidence === "number"
        ? Math.max(0, Math.min(1, item.confidence))
        : 0,
  };
}
