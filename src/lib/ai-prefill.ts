/**
 * Passes AI identification data from the scan result to the item form.
 * Uses sessionStorage so the data survives a hash-route navigation but
 * doesn't persist across sessions (a stale prefill on next app open would
 * be confusing).
 */

const KEY = "tooldeck:ai-prefill";

export type AiPrefill = {
  name: string;
  brand: string | null;
  model: string | null;
  category: string; // category NAME (not id) — the form resolves it
  trackingType: "asset" | "stock";
  condition: string;
  quantity?: number;
  photoBase64: string;
  aiConfidence: number;
};

export function setAiPrefill(data: AiPrefill): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function getAiPrefill(): AiPrefill | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiPrefill;
  } catch {
    return null;
  }
}

export function clearAiPrefill(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
