"use client";

import { useEffect, useState, useRef } from "react";
import {
  ScanLine,
  Camera,
  Sparkles,
  Pencil,
  Loader2,
  Check,
  X,
  Package,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHashRoute } from "@/hooks/use-hash-route";
import { compressImage } from "@/lib/compress-image";
import { setAiPrefill } from "@/lib/ai-prefill";
import { StatusPill } from "@/components/status-pill";

type IdentifiedItem = {
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  tracking_type: "asset" | "stock";
  condition_guess: string;
  estimated_quantity: number | null;
  description: string;
  identifying_features: string[];
  confidence: number;
  matches: Array<{
    id: string;
    code: string;
    name: string;
    brand: string | null;
    model: string | null;
    photoUrl: string | null;
    status: string;
    similarity: number;
  }>;
};

type IdentifyResult = {
  multi_item: boolean;
  items: IdentifiedItem[];
};

const TIPS = [
  "Point at any tool — I'll do the rest.",
  "Good lighting helps the AI read the model.",
  "One item per shot works best.",
  "Brands and model labels boost accuracy.",
  "For a box of items, I'll list each one.",
];

export function ScanView() {
  const [tip, setTip] = useState(0);
  const { toast } = useToast();
  const [, navigate] = useHashRoute();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScans, setLastScans] = useState<string[]>([]);

  // Abort controller for the in-flight identify request — allows cancellation
  // when the user taps "Cancel" or starts a new scan.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200);
    return () => {
      clearInterval(id);
      // Abort any in-flight request on unmount
      abortRef.current?.abort();
    };
  }, []);

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Guard: don't start a new scan if one is already in-flight
    if (analyzing) return;

    // Abort any previous in-flight request
    abortRef.current?.abort();

    setError(null);
    setAnalyzing(true);

    // Create a new abort controller for this request
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Compress the photo client-side (§4: max 1280px, JPEG 0.8)
      const compressed = await compressImage(file);
      setPhotoBase64(compressed);

      // Call the vision API with abort signal + 45s client-side timeout
      const timeout = setTimeout(() => controller.abort(), 45_000);

      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: compressed }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const base = err.error ?? "AI identification failed";
        // Surface the underlying reason (config/model/API error) when present.
        throw new Error(err.detail ? `${base} — ${err.detail}` : base);
      }

      const data: IdentifyResult = await res.json();
      setResult(data);

      // Track last 3 scans (store the base64 — small enough for 3 items)
      setLastScans((prev) => [compressed, ...prev].slice(0, 3));
    } catch (e) {
      // Don't show error if the user cancelled
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
      // Reset the input so the same file can be re-captured
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function cancelAnalysis() {
    abortRef.current?.abort();
    setAnalyzing(false);
    setPhotoBase64(null);
    abortRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function reset() {
    // Abort any in-flight request
    abortRef.current?.abort();
    abortRef.current = null;

    // Clear all state — allows GC of the base64 strings
    setPhotoBase64(null);
    setResult(null);
    setError(null);
  }

  // If we have a result, show the result sheet instead of the camera
  if (result && photoBase64) {
    return (
      <ScanResult
        result={result}
        photoBase64={photoBase64}
        onReset={reset}
        navigate={navigate}
        toast={toast}
      />
    );
  }

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        id="scan-camera-input"
      />

      {/* camera viewport */}
      <div
        className="relative flex aspect-[3/4] w-full max-w-sm items-center justify-center overflow-hidden rounded-[var(--radius-card)]"
        style={{
          border: "1px solid var(--color-border)",
          background:
            "radial-gradient(120% 90% at 50% 30%, rgba(14,79,74,0.45) 0%, rgba(3,10,10,0.9) 70%)",
        }}
      >
        <Bracket className="left-4 top-4" edges={["t", "l"]} />
        <Bracket className="right-4 top-4" edges={["t", "r"]} />
        <Bracket className="bottom-4 left-4" edges={["b", "l"]} />
        <Bracket className="bottom-4 right-4" edges={["b", "r"]} />

        {analyzing && photoBase64 ? (
          // Show the captured photo with an analyzing overlay
          <>
            <img
              src={photoBase64}
              alt="Captured"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: 0.5 }}
            />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <Loader2
                size={36}
                className="animate-spin"
                style={{ color: "var(--color-teal)" }}
              />
              <p className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                Identifying…
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                Reading the photo
              </p>
              <button
                type="button"
                onClick={cancelAnalysis}
                className="mt-2 flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors hover:bg-[rgba(224,86,107,0.1)]"
                style={{
                  border: "1px solid rgba(224,86,107,0.3)",
                  color: "var(--color-danger)",
                }}
              >
                <X size={13} /> Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                border: "1px solid rgba(25,227,196,0.4)",
                color: "var(--color-teal)",
              }}
            >
              <Camera size={26} />
            </span>
            <p className="micro-label">Camera viewport</p>
            <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
              Tap the shutter to identify a tool
            </p>
          </div>
        )}

        {/* scan line sweep decoration */}
        {!analyzing && (
          <div
            className="pointer-events-none absolute inset-x-8 top-1/2 h-px pulse-live"
            style={{ background: "rgba(25,227,196,0.4)" }}
          />
        )}
      </div>

      {/* error */}
      {error && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            border: "1px solid rgba(224,86,107,0.3)",
            background: "rgba(224,86,107,0.08)",
            color: "var(--color-danger)",
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* rotating tip */}
      {!analyzing && (
        <p
          key={tip}
          className="mt-6 flex items-center gap-2 text-sm"
          style={{ color: "var(--color-text-mid)" }}
        >
          <Sparkles size={14} style={{ color: "var(--color-teal)" }} />
          {TIPS[tip]}
        </p>
      )}

      {/* shutter */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={analyzing}
        className="glow-ring pulse-live mt-6 flex h-20 w-20 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50"
        style={{
          background: "var(--color-teal)",
          color: "#04211d",
          border: "3px solid var(--color-bg-0)",
        }}
        aria-label="Capture and identify"
      >
        {analyzing ? (
          <Loader2 size={28} className="animate-spin" />
        ) : (
          <ScanLine size={30} strokeWidth={2.2} />
        )}
      </button>

      {/* Add manually CTA */}
      <button
        type="button"
        onClick={() => navigate({ name: "item-new" })}
        className="btn-ghost-teal mt-5 flex h-10 items-center gap-2 px-5 text-sm"
      >
        <Pencil size={15} /> Add manually
      </button>

      {/* last scans */}
      <div className="mt-8 w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="micro-label">Last scans</span>
          <span className="micro-label" style={{ color: "var(--color-text-low)" }}>
            {lastScans.length} of 3
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl"
              style={{
                border: lastScans[i]
                  ? "1px solid var(--color-border)"
                  : "1px dashed rgba(126,222,210,0.18)",
              }}
            >
              {lastScans[i] ? (
                <img
                  src={lastScans[i]}
                  alt="Last scan"
                  className="h-full w-full object-cover"
                  style={{ opacity: 0.6 }}
                />
              ) : (
                <Camera size={18} style={{ color: "var(--color-text-low)" }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Scan Result Sheet ────────────────────────────────────────────────────
// Handles the confidence tiers (§6) + dedupe matches + multi-item picker.

function ScanResult({
  result,
  photoBase64,
  onReset,
  navigate,
  toast,
}: {
  result: IdentifyResult;
  photoBase64: string;
  onReset: () => void;
  navigate: ReturnType<typeof useHashRoute>[1];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  // If multi-item, show the picker first
  if (result.multi_item && result.items.length > 1) {
    return (
      <MultiItemPicker
        result={result}
        photoBase64={photoBase64}
        selectedIdx={selectedIdx}
        onSelect={setSelectedIdx}
        onReset={onReset}
        navigate={navigate}
        toast={toast}
      />
    );
  }

  const item = result.items[0];
  if (!item) {
    // No items identified — go to manual form
    return (
      <ManualFallback
        photoBase64={photoBase64}
        onReset={onReset}
        navigate={navigate}
        toast={toast}
      />
    );
  }

  return (
    <SingleItemResult
      item={item}
      photoBase64={photoBase64}
      onReset={onReset}
      navigate={navigate}
      toast={toast}
    />
  );
}

// ── Single Item Result ───────────────────────────────────────────────────
function SingleItemResult({
  item,
  photoBase64,
  onReset,
  navigate,
  toast,
}: {
  item: IdentifiedItem;
  photoBase64: string;
  onReset: () => void;
  navigate: ReturnType<typeof useHashRoute>[1];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const confidence = item.confidence;
  const tier =
    confidence >= 0.75
      ? "high"
      : confidence >= 0.4
      ? "medium"
      : "low";

  // Low confidence → manual form with photo
  if (tier === "low") {
    return (
      <ManualFallback
        photoBase64={photoBase64}
        onReset={onReset}
        navigate={navigate}
        toast={toast}
        description={item.description}
      />
    );
  }

  const needsConfirm = tier === "medium"; // highlight category + tracking_type

  // Has strong dedupe matches → show "looks like this might already be in inventory"
  const hasMatches = item.matches.length > 0;

  return (
    <div className="px-5 pt-4">
      {/* Photo hero */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)]" style={{ border: "1px solid var(--color-border)" }}>
        <img src={photoBase64} alt="Captured" className="aspect-[4/3] w-full object-cover" />
        <div className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(3,10,10,0.85)", color: confidenceColor(confidence), border: `1px solid ${confidenceColor(confidence)}` }}>
          {Math.round(confidence * 100)}% confident
        </div>
        <button
          onClick={onReset}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(3,10,10,0.85)", color: "var(--color-text-hi)", border: "1px solid var(--color-border)" }}
          aria-label="Scan again"
        >
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      <p className="mt-4 text-sm" style={{ color: "var(--color-text-mid)" }}>
        {item.description}
      </p>

      {/* Possible existing matches (snap-to-find) */}
      {hasMatches && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={14} style={{ color: "var(--color-gold)" }} />
            <span className="micro-label" style={{ color: "var(--color-gold)" }}>
              Looks like this might already be in inventory
            </span>
          </div>
          <div className="space-y-2">
            {item.matches.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate({ name: "item-detail", id: m.id })}
                className="glass-card flex w-full items-center gap-3 p-3 text-left transition-all hover:border-[rgba(201,160,99,0.5)]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package size={16} style={{ color: "var(--color-text-low)" }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="micro-label">{m.code}</span>
                  <p className="truncate text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                    {m.name}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--color-text-low)" }}>
                    {[m.brand, m.model].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <StatusPill status={m.status as "available" | "checked_out" | "needs_service" | "out_of_order"} />
                <ArrowRight size={16} style={{ color: "var(--color-text-low)" }} />
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs" style={{ color: "var(--color-text-low)" }}>
            None of these? Add as new ↓
          </p>
        </div>
      )}

      {/* AI-filled summary card */}
      <div className="glass-card mt-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={14} style={{ color: "var(--color-teal)" }} />
          <span className="micro-label">AI identification</span>
        </div>
        <div className="space-y-2 text-sm">
          <SummaryRow label="Name" value={item.name} />
          {item.brand && <SummaryRow label="Brand" value={item.brand} />}
          {item.model && <SummaryRow label="Model" value={item.model} />}
          <SummaryRow
            label="Category"
            value={item.category}
            highlight={needsConfirm}
          />
          <SummaryRow
            label="Type"
            value={item.tracking_type === "asset" ? "Unique asset" : "Stock"}
            highlight={needsConfirm}
          />
          {item.tracking_type === "stock" && item.estimated_quantity && (
            <SummaryRow label="Est. quantity" value={String(item.estimated_quantity)} />
          )}
          {item.identifying_features.length > 0 && (
            <div className="flex gap-2 pt-1">
              <span className="micro-label flex-shrink-0">Features</span>
              <span className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                {item.identifying_features.join(" · ")}
              </span>
            </div>
          )}
        </div>
        {needsConfirm && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-gold)" }}>
            Please verify the highlighted fields before saving.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-3 pb-2">
        <button onClick={onReset} className="btn-ghost-teal flex-1 h-11 flex items-center justify-center gap-2 text-sm">
          <RotateCcw size={15} /> Scan again
        </button>
        <button
          onClick={() => {
            setAiPrefill({
              name: item.name,
              brand: item.brand,
              model: item.model,
              category: item.category,
              trackingType: item.tracking_type,
              condition:
                item.condition_guess === "good" ||
                item.condition_guess === "needs_service" ||
                item.condition_guess === "out_of_order"
                  ? item.condition_guess
                  : "good",
              quantity: item.estimated_quantity ?? undefined,
              photoBase64,
              aiConfidence: item.confidence,
            });
            navigate({ name: "item-new" });
          }}
          className="btn-teal flex-[2] h-11 flex items-center justify-center gap-2 text-sm"
        >
          <Check size={16} /> Add as new item
        </button>
      </div>

      {/* Pre-fill note */}
      <p className="mt-3 text-center text-xs" style={{ color: "var(--color-text-low)" }}>
        Tapping “Add as new item” opens a pre-filled form with the photo attached.
      </p>
    </div>
  );
}

// ── Multi-Item Picker (box of tools) ─────────────────────────────────────
function MultiItemPicker({
  result,
  photoBase64,
  selectedIdx,
  onSelect,
  onReset,
  navigate,
  toast,
}: {
  result: IdentifyResult;
  photoBase64: string;
  selectedIdx: number;
  onSelect: (i: number) => void;
  onReset: () => void;
  navigate: ReturnType<typeof useHashRoute>[1];
  toast: ReturnType<typeof useToast>["toast"];
}) {
  return (
    <div className="px-5 pt-4">
      {/* Photo hero */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)]" style={{ border: "1px solid var(--color-border)" }}>
        <img src={photoBase64} alt="Captured" className="aspect-[4/3] w-full object-cover" />
        <div className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(3,10,10,0.85)", color: "var(--color-gold)", border: "1px solid var(--color-gold)" }}>
          {result.items.length} items found
        </div>
        <button
          onClick={onReset}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(3,10,10,0.85)", color: "var(--color-text-hi)", border: "1px solid var(--color-border)" }}
          aria-label="Scan again"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mt-4 text-sm" style={{ color: "var(--color-text-mid)" }}>
        This photo contains multiple items. Tap one to add it, or scan again
        for a single-item shot.
      </p>

      {/* Item list */}
      <div className="mt-4 space-y-3">
        {result.items.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`glass-card w-full p-4 text-left transition-all ${
              selectedIdx === i ? "glass-selected" : "hover:border-[rgba(25,227,196,0.35)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="num-chip">{i + 1}</span>
                  <span className="micro-label">{Math.round(item.confidence * 100)}% confident</span>
                </div>
                <p className="mt-1.5 text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                  {item.name}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                  {item.category} · {item.tracking_type === "asset" ? "Asset" : "Stock"}
                </p>
                {item.brand && (
                  <p className="text-xs" style={{ color: "var(--color-text-low)" }}>
                    {item.brand}{item.model ? ` ${item.model}` : ""}
                  </p>
                )}
              </div>
              {selectedIdx === i && (
                <Check size={18} style={{ color: "var(--color-gold)" }} />
              )}
            </div>
            {item.matches.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--color-gold)" }}>
                ⚡ {item.matches.length} possible existing match{item.matches.length > 1 ? "es" : ""}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-3 pb-2">
        <button onClick={onReset} className="btn-ghost-teal flex-1 h-11 flex items-center justify-center gap-2 text-sm">
          <RotateCcw size={15} /> Scan again
        </button>
        <button
          onClick={() => {
            const item = result.items[selectedIdx];
            if (!item) return;
            setAiPrefill({
              name: item.name,
              brand: item.brand,
              model: item.model,
              category: item.category,
              trackingType: item.tracking_type,
              condition:
                item.condition_guess === "good" ||
                item.condition_guess === "needs_service" ||
                item.condition_guess === "out_of_order"
                  ? item.condition_guess
                  : "good",
              quantity: item.estimated_quantity ?? undefined,
              photoBase64,
              aiConfidence: item.confidence,
            });
            navigate({ name: "item-new" });
          }}
          className="btn-teal flex-[2] h-11 flex items-center justify-center gap-2 text-sm"
        >
          <Check size={16} /> Add selected
        </button>
      </div>
    </div>
  );
}

// ── Manual Fallback (low confidence or no items) ─────────────────────────
function ManualFallback({
  photoBase64,
  onReset,
  navigate,
  toast,
  description,
}: {
  photoBase64: string;
  onReset: () => void;
  navigate: ReturnType<typeof useHashRoute>[1];
  toast: ReturnType<typeof useToast>["toast"];
  description?: string;
}) {
  return (
    <div className="px-5 pt-4">
      <div className="relative overflow-hidden rounded-[var(--radius-card)]" style={{ border: "1px solid var(--color-border)" }}>
        <img src={photoBase64} alt="Captured" className="aspect-[4/3] w-full object-cover" style={{ opacity: 0.6 }} />
        <div className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(3,10,10,0.85)", color: "var(--color-text-mid)", border: "1px solid var(--color-border)" }}>
          Not sure
        </div>
      </div>

      <div className="glass-card mt-4 p-4 text-center">
        <AlertCircle size={24} style={{ color: "var(--color-text-low)", margin: "0 auto" }} />
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
          Couldn't identify this with confidence
        </p>
        {description && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-mid)" }}>
            {description}
          </p>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-low)" }}>
          You can add it manually — the photo is already attached.
        </p>
      </div>

      <div className="mt-5 flex gap-3 pb-2">
        <button onClick={onReset} className="btn-ghost-teal flex-1 h-11 flex items-center justify-center gap-2 text-sm">
          <RotateCcw size={15} /> Scan again
        </button>
        <button
          onClick={() => navigate({ name: "item-new" })}
          className="btn-teal flex-[2] h-11 flex items-center justify-center gap-2 text-sm"
        >
          <Pencil size={16} /> Add manually
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
function confidenceColor(c: number): string {
  if (c >= 0.75) return "var(--color-teal)";
  if (c >= 0.4) return "var(--color-gold)";
  return "var(--color-text-low)";
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="micro-label">{label}</span>
      <span
        className="text-right text-sm"
        style={{
          color: highlight ? "var(--color-gold)" : "var(--color-text-hi)",
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Bracket({
  className,
  edges,
}: {
  className: string;
  edges: ("t" | "r" | "b" | "l")[];
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "var(--color-teal)",
    borderStyle: "solid",
    borderWidth: 0,
  };
  if (edges.includes("t")) style.borderTopWidth = 2;
  if (edges.includes("b")) style.borderBottomWidth = 2;
  if (edges.includes("l")) style.borderLeftWidth = 2;
  if (edges.includes("r")) style.borderRightWidth = 2;
  return <div className={className} style={style} />;
}
