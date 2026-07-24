"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress-image";
import { getAiPrefill, clearAiPrefill, type AiPrefill } from "@/lib/ai-prefill";

type Meta = {
  categories: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
};

export function ItemFormView({ id }: { id?: string }) {
  const isEdit = !!id;
  const [, navigate] = useHashRoute();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [trackingType, setTrackingType] = useState<"asset" | "stock">("asset");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("good");
  const [homeLocationId, setHomeLocationId] = useState("");
  const [currentLocationId, setCurrentLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Fetch meta (categories + locations)
  const { data: meta } = useQuery<Meta>({
    queryKey: ["meta"],
    queryFn: async () => {
      const res = await fetch("/api/meta");
      if (!res.ok) throw new Error("Failed to load metadata");
      return res.json();
    },
  });

  // If editing, fetch the existing item
  const { data: existing } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) throw new Error("Failed to load item");
      return res.json() as Promise<{
        item: Record<string, unknown>;
      }>;
    },
    enabled: isEdit,
  });

  // AI prefill — when arriving from the scan result, pre-fill the form with
  // the AI identification + photo. Runs once on mount for new items only.
  const prefillApplied = useRef(false);
  const pendingPrefill = useRef<AiPrefill | null>(null);

  useEffect(() => {
    if (isEdit || prefillApplied.current) return;

    // 1. Grab the prefill from storage once and clear it immediately to prevent leaks
    if (!pendingPrefill.current) {
      const prefill = getAiPrefill();
      if (!prefill) return;
      pendingPrefill.current = prefill;
      clearAiPrefill();
    }

    // 2. Wait for meta (categories) to load before applying the prefill.
    // We need the categories list to resolve the AI's category string into a valid ID.
    if (meta) {
      prefillApplied.current = true;
      applyAiPrefill(pendingPrefill.current, meta.categories);
    }
  }, [isEdit, meta]);

  // Populate form when editing — guarded by a ref so React Query refetches
  // (staleTime expiry, invalidation) don't overwrite in-progress edits.
  const initialised = useRef(false);
  useEffect(() => {
    if (!existing?.item || initialised.current) return;
    initialised.current = true;
    const it = existing.item as {
      name: string;
      brand: string | null;
      model: string | null;
      serialNo: string | null;
      categoryId: string | null;
      trackingType: string;
      quantity: number;
      condition: string;
      homeLocationId: string | null;
      currentLocationId: string | null;
      notes: string | null;
      photoUrl: string | null;
    };
    setName(it.name);
    setBrand(it.brand ?? "");
    setModel(it.model ?? "");
    setSerialNo(it.serialNo ?? "");
    setCategoryId(it.categoryId ?? "");
    setTrackingType(it.trackingType as "asset" | "stock");
    setQuantity(String(it.quantity));
    setCondition(it.condition);
    setHomeLocationId(it.homeLocationId ?? "");
    setCurrentLocationId(it.currentLocationId ?? "");
    setNotes(it.notes ?? "");
    setPhotoPreview(it.photoUrl);
  }, [existing]);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressImage(file);
      setPhotoBase64(compressed);
      setPhotoPreview(compressed);
    } catch {
      toast({ title: "Photo error", description: "Could not process image." });
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    setPhotoBase64(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name required", description: "Enter an item name." });
      return;
    }
    setBusy(true);

    // Parse numeric fields safely (0 is a valid quantity — don't || it away)
    const q = parseFloat(quantity);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      serialNo: serialNo.trim() || null,
      categoryId: categoryId || null,
      // trackingType is only sent on create (immutable after)
      ...(isEdit ? {} : { trackingType }),
      quantity: Number.isFinite(q) ? q : 1,
      condition,
      homeLocationId: homeLocationId || null,
      currentLocationId: currentLocationId || null,
      notes: notes.trim() || null,
      ...(aiConfidence !== null ? { aiConfidence } : {}),
    };
    if (photoBase64) payload.photoBase64 = photoBase64;

    try {
      const url = isEdit ? `/api/items/${id}` : "/api/items";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Save failed",
          description: err.error ?? "Please try again.",
        });
        setBusy(false);
        return;
      }

      const data = await res.json();
      // Invalidate lists
      qc.invalidateQueries({ queryKey: ["items"] });

      toast({
        title: isEdit ? "Item updated" : "Item added",
        description: `${data.item?.code ?? name} saved.`,
      });

      navigate(
        isEdit && id
          ? { name: "item-detail", id }
          : { name: "item-detail", id: data.item.id }
      );
    } catch {
      toast({ title: "Save failed", description: "Please try again." });
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pt-4">
      <button
        onClick={() =>
          navigate(
            isEdit && id
              ? { name: "item-detail", id }
              : { name: "items" }
          )
        }
        className="flex items-center gap-1 text-sm transition-colors hover:text-[var(--color-teal)]"
        style={{ color: "var(--color-text-mid)" }}
      >
        <ArrowLeft size={16} /> {isEdit ? "Item" : "Items"}
      </button>

      <h1 className="mt-3 text-2xl font-bold">
        {isEdit ? "Edit item" : "Add item"}
      </h1>
      <p className="micro-label mt-1">
        {isEdit ? "Update details" : aiConfidence !== null ? "AI pre-filled — review & save" : "Manual entry"}
      </p>
      {aiConfidence !== null && aiConfidence > 0 && (
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{
            background: "rgba(25,227,196,0.1)",
            color: "var(--color-teal)",
            border: "1px solid rgba(25,227,196,0.3)",
          }}
        >
          ✨ AI identified · {Math.round(aiConfidence * 100)}% confidence
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Photo capture */}
        <div>
          <span className="micro-label mb-2 block">Photo</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
            id="photo-input"
          />
          {photoPreview ? (
            <div className="relative">
              <div
                className="aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]"
                style={{ border: "1px solid var(--color-border)" }}
              >
                { }
                <img
                  src={photoPreview}
                  alt="Item preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={removePhoto}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: "rgba(3,10,10,0.8)",
                  color: "var(--color-danger)",
                  border: "1px solid rgba(224,86,107,0.3)",
                }}
                aria-label="Remove photo"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="photo-input"
              className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] transition-colors hover:border-[rgba(25,227,196,0.35)]"
              style={{
                border: "1px dashed var(--color-border)",
                background: "rgba(6,17,17,0.4)",
              }}
            >
              {photoBusy ? (
                <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-teal)" }} />
              ) : (
                <Camera size={24} style={{ color: "var(--color-text-low)" }} />
              )}
              <span className="text-xs" style={{ color: "var(--color-text-low)" }}>
                Tap to capture
              </span>
            </label>
          )}
        </div>

        {/* Tracking type toggle (disabled in edit mode — immutable after creation) */}
        <div>
          <span className="micro-label mb-2 block">
            Tracking type
            {isEdit && (
              <span style={{ color: "var(--color-text-low)" }}> · locked</span>
            )}
          </span>
          <div
            className="flex gap-1 rounded-full p-1"
            style={{
              border: "1px solid var(--color-border)",
              opacity: isEdit ? 0.5 : 1,
              pointerEvents: isEdit ? "none" : "auto",
            }}
            aria-disabled={isEdit}
          >
            <TypeToggle
              active={trackingType === "asset"}
              onClick={() => setTrackingType("asset")}
            >
              Unique asset
            </TypeToggle>
            <TypeToggle
              active={trackingType === "stock"}
              onClick={() => setTrackingType("stock")}
            >
              Stock (counted)
            </TypeToggle>
          </div>
        </div>

        {/* Name */}
        <FormField label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Angle grinder 115mm"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
            style={{ color: "var(--color-text-hi)" }}
            required
          />
        </FormField>

        {/* Brand + Model */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Brand">
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Makita"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
              style={{ color: "var(--color-text-hi)" }}
            />
          </FormField>
          <FormField label="Model">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="GA011GZ"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
              style={{ color: "var(--color-text-hi)" }}
            />
          </FormField>
        </div>

        {/* Serial */}
        <FormField label="Serial number">
          <input
            type="text"
            value={serialNo}
            onChange={(e) => setSerialNo(e.target.value)}
            placeholder="Optional"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
            style={{ color: "var(--color-text-hi)" }}
          />
        </FormField>

        {/* Category */}
        <FormField label="Category">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-hi)" }}
          >
            <option value="" style={{ background: "var(--color-bg-1)" }}>
              Select category…
            </option>
            {meta?.categories.map((c) => (
              <option key={c.id} value={c.id} style={{ background: "var(--color-bg-1)" }}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>

        {/* Stock fields */}
        {trackingType === "stock" && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity">
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              />
            </FormField>
          </div>
        )}

        {/* Condition */}
        <FormField label="Condition">
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-hi)" }}
          >
            <option value="good" style={{ background: "var(--color-bg-1)" }}>
              Good
            </option>
            <option value="needs_service" style={{ background: "var(--color-bg-1)" }}>
              Needs service
            </option>
            <option value="out_of_order" style={{ background: "var(--color-bg-1)" }}>
              Out of order
            </option>
          </select>
        </FormField>

        {/* Locations */}
        <FormField label="Home location">
          <select
            value={homeLocationId}
            onChange={(e) => setHomeLocationId(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-hi)" }}
          >
            <option value="" style={{ background: "var(--color-bg-1)" }}>
              None
            </option>
            {meta?.locations.map((l) => (
              <option key={l.id} value={l.id} style={{ background: "var(--color-bg-1)" }}>
                {l.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Current location">
          <select
            value={currentLocationId}
            onChange={(e) => setCurrentLocationId(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-hi)" }}
          >
            <option value="" style={{ background: "var(--color-bg-1)" }}>
              Same as home
            </option>
            {meta?.locations.map((l) => (
              <option key={l.id} value={l.id} style={{ background: "var(--color-bg-1)" }}>
                {l.name}
              </option>
            ))}
          </select>
        </FormField>

        {/* Notes */}
        <FormField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            rows={3}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
            style={{ color: "var(--color-text-hi)" }}
          />
        </FormField>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                isEdit && id
                  ? { name: "item-detail", id }
                  : { name: "items" }
              )
            }
            className="btn-ghost-teal flex-1 h-11 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="btn-teal flex-[2] h-11 flex items-center justify-center gap-2 text-sm"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );

  // Apply AI prefill data from the scan result
  function applyAiPrefill(
    prefill: AiPrefill,
    categories: Array<{ id: string; name: string }>
  ) {
    setName(prefill.name);
    setBrand(prefill.brand ?? "");
    setModel(prefill.model ?? "");
    setTrackingType(prefill.trackingType);
    setCondition(prefill.condition);
    if (prefill.quantity !== undefined) setQuantity(String(prefill.quantity));
    // Resolve category name → id
    const cat = categories.find((c) => c.name === prefill.category);
    if (cat) setCategoryId(cat.id);
    // Set the photo
    setPhotoBase64(prefill.photoBase64);
    setPhotoPreview(prefill.photoBase64);
    setAiConfidence(prefill.aiConfidence);
  }
}

function TypeToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full py-2 text-sm font-medium transition-all"
      style={{
        background: active ? "var(--color-teal)" : "transparent",
        color: active ? "#04211d" : "var(--color-text-mid)",
      }}
    >
      {children}
    </button>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="micro-label">
        {label}
        {required && <span style={{ color: "var(--color-teal)" }}> *</span>}
      </span>
      <div
        className="rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
        style={{
          border: "1px solid var(--color-border)",
          background: "rgba(6,17,17,0.6)",
        }}
      >
        {children}
      </div>
    </label>
  );
}
