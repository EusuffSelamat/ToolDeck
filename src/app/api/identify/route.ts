import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

/**
 * POST /api/identify — AI vision identification endpoint (§6).
 *
 * Receives a compressed base64 JPEG, calls the Z.ai vision model
 * (glm-4.6v-flash via z-ai-web-dev-sdk) with the §6 system prompt,
 * then runs dedupe against existing items.
 *
 * Key adaptation: the §6 prompt assumed "one photo of an item", but real
 * workshop photos are often boxes/crates with multiple items. The prompt
 * now returns either a single item OR an array of items, plus a
 * `multi_item` flag. The client handles both cases.
 *
 * Confidence tiers (§6):
 *   ≥ 0.75 → fully pre-filled confirm sheet
 *   0.40–0.74 → pre-filled, category/tracking_type highlighted
 *   < 0.40 → manual add form with photo attached
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

type IdentifyResponse = {
  multi_item: boolean;
  items: IdentifiedItem[];
  raw_response?: string;
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

// ── Trigram similarity (replaces pg_trgm) ───────────────────────────────
// Jaccard similarity over character trigrams. pg_trgm uses the same metric.
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

// ── Dedupe query (§6) ───────────────────────────────────────────────────
// Runs after identification to find possible existing matches.
async function findMatches(candidate: string): Promise<MatchCandidate[]> {
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
    take: 500, // cap for performance at scale
  });

  return items
    .map((item) => {
      const candidateText = candidate.toLowerCase();
      const itemText = `${item.name} ${item.brand ?? ""} ${item.model ?? ""}`.toLowerCase();
      return {
        ...item,
        similarity: trigramSimilarity(candidateText, itemText),
      };
    })
    .filter((m) => m.similarity > 0.45)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

// ── API handler ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Fetch live category list for the prompt
  const categories = await db.category.findMany({
    orderBy: { sort: "asc" },
    select: { name: true },
  });
  const categoryList = categories.map((c) => c.name).join(", ");

  // Build the system prompt (§6, extended for multi-item photos)
  const systemPrompt = buildSystemPrompt(categoryList);

  // Call the vision model
  let rawResponse: string;
  try {
    rawResponse = await callVisionModel(imageBase64, systemPrompt);
  } catch (e) {
    console.error("Vision model call failed:", e);
    return NextResponse.json(
      { error: "Could not analyse the photo. Please try again or add manually." },
      { status: 502 }
    );
  }

  // Parse the JSON response (with one repair retry per §6)
  let parsed: IdentifyResponse;
  try {
    parsed = parseVisionResponse(rawResponse);
  } catch {
    // Retry once with a repair instruction
    try {
      const repaired = await callVisionModel(
        imageBase64,
        "Your last reply was not valid JSON. Re-emit only the JSON object."
      );
      parsed = parseVisionResponse(repaired);
    } catch {
      // Treat as confidence 0 — open manual form
      parsed = {
        multi_item: false,
        items: [
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
        ],
        raw_response: rawResponse.slice(0, 500),
      };
    }
  }

  // Run dedupe for each identified item
  const itemsWithMatches = await Promise.all(
    parsed.items.map(async (item) => ({
      ...item,
      matches: await findMatches(
        `${item.name} ${item.brand ?? ""} ${item.model ?? ""}`
      ),
    }))
  );

  return NextResponse.json({
    multi_item: parsed.multi_item,
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

// ── Vision model call (z-ai-web-dev-sdk, server-only) ───────────────────
async function callVisionModel(
  imageBase64: string,
  systemPrompt: string
): Promise<string> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  // Ensure the base64 has the data URL prefix
  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const response = await zai.chat.completions.createVision({
    model: "glm-4.6v-flash",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identify the tool(s) in this photo. Reply with only the JSON object.",
          },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });

  return response.choices[0]?.message?.content ?? "";
}

// ── Response parser (handles single-item + multi-item shapes) ───────────
function parseVisionResponse(raw: string): IdentifyResponse {
  // Strip markdown code fences if present
  let clean = raw.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```$/, "");
  }

  const data = JSON.parse(clean);

  // Case 1: Multi-item response (has "items" array)
  if (data.items && Array.isArray(data.items)) {
    return {
      multi_item: Boolean(data.multi_item),
      items: data.items.map(normalizeItem),
    };
  }

  // Case 2: Single-item response (flat object) — normalize to array
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
