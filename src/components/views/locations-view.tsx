"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Plus,
  Package,
  Pencil,
  Trash2,
  X,
  Building2,
  DoorOpen,
  Truck,
  ArrowRight,
  Loader2,
  Home,
  LogOut,
} from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useToast } from "@/hooks/use-toast";
import { setLocationFilter } from "@/lib/location-filter";
import { useRole } from "@/hooks/use-role";

type LocationData = {
  id: string;
  name: string;
  kind: string;
  parentLocationId: string | null;
  parentName: string | null;
  childrenCount: number;
  itemCount: number;
  directItemCount: number;
  homeItemCount: number;
  awayCount: number;
  awayBreakdown: Array<{ location: string; count: number }>;
  topCategories: Array<{ name: string; count: number }>;
};

const KIND_ICON: Record<string, typeof Building2> = {
  site: Building2,
  room: DoorOpen,
  vehicle: Truck,
};

export function LocationsView() {
  const [, navigate] = useHashRoute();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const role = useRole();
  const isAdmin = role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to load locations");
      return res.json() as Promise<{ locations: LocationData[] }>;
    },
  });

  const locations = data?.locations ?? [];

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({
        title: "Cannot delete",
        description: data.error ?? "Please try again.",
      });
      return;
    }
    qc.invalidateQueries({ queryKey: ["locations"] });
    qc.invalidateQueries({ queryKey: ["meta"] });
    toast({ title: "Location deleted", description: name });
  }

  function handleTapLocation(loc: LocationData) {
    // Default to "currently here" when tapping the card
    setLocationFilter(loc.id, loc.name, "current");
    navigate({ name: "items" });
  }

  function handleTapHome(loc: LocationData) {
    // Tap the "home" section to see items whose home is here
    setLocationFilter(loc.id, loc.name, "home");
    navigate({ name: "items" });
  }

  return (
    <div className="px-5 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="micro-label mt-1">
            {locations.length} {locations.length === 1 ? "location" : "locations"}
          </p>
        </div>
        {isAdmin && (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="btn-teal flex h-10 items-center gap-1.5 px-4 text-sm"
          aria-label="Add location"
        >
          <Plus size={16} /> Add
        </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="glass-card h-24 animate-pulse"
              style={{ background: "rgba(10,26,26,0.3)" }}
            />
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text-low)",
            }}
          >
            <MapPin size={24} />
          </span>
          <div>
            <p className="text-base font-medium" style={{ color: "var(--color-text-hi)" }}>
              No locations yet
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
              Add sites, rooms, and vehicles to track where items live.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-teal mt-1 flex h-10 items-center gap-2 px-5 text-sm"
          >
            <Plus size={15} /> Add location
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          {(() => {
            // Build a tree: roots (parentLocationId === null) + children map
            const roots = locations.filter((l) => !l.parentLocationId);
            const childrenByParent = new Map<string, LocationData[]>();
            for (const loc of locations) {
              if (loc.parentLocationId) {
                const arr = childrenByParent.get(loc.parentLocationId) ?? [];
                arr.push(loc);
                childrenByParent.set(loc.parentLocationId, arr);
              }
            }

            return roots.map((loc) => (
              <LocationTreeNode
                key={loc.id}
                loc={loc}
                childrenByParent={childrenByParent}
                depth={0}
                onTapLocation={handleTapLocation}
                onTapHome={handleTapHome}
                onEdit={(id) => {
                  setEditingId(id);
                  setShowForm(true);
                }}
                onDelete={handleDelete}
                isAdmin={isAdmin}
              />
            ));
          })()}
        </div>
      )}

      {showForm && (
        <LocationForm
          locationId={editingId}
          existingName={editingId ? locations.find((l) => l.id === editingId)?.name ?? "" : ""}
          existingKind={editingId ? locations.find((l) => l.id === editingId)?.kind ?? "site" : "site"}
          existingParentId={editingId ? locations.find((l) => l.id === editingId)?.parentLocationId ?? null : null}
          allLocations={locations}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ["locations"] });
            qc.invalidateQueries({ queryKey: ["meta"] });
          }}
        />
      )}
    </div>
  );
}

// ── Location Add/Edit Form (modal) ──────────────────────────────────────
function LocationForm({
  locationId,
  existingName,
  existingKind,
  existingParentId,
  allLocations,
  onClose,
  onSaved,
}: {
  locationId: string | null;
  existingName: string;
  existingKind: string;
  existingParentId: string | null;
  allLocations: LocationData[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(existingName);
  const [kind, setKind] = useState(existingKind);
  const [parentLocationId, setParentLocationId] = useState(existingParentId ?? "");
  const [busy, setBusy] = useState(false);
  const isEdit = !!locationId;

  // Exclude self + descendants from the parent picker (prevents cycles client-side)
  const eligibleParents = allLocations.filter((l) => {
    if (!locationId) return true;
    if (l.id === locationId) return false;
    // Exclude descendants — walk up each location's parent chain
    let cursor: LocationData | undefined = l;
    while (cursor) {
      if (cursor.parentLocationId === locationId) return false;
      if (cursor.id === locationId) return false;
      cursor = cursor.parentLocationId
        ? allLocations.find((x) => x.id === cursor!.parentLocationId)
        : undefined;
    }
    return true;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);

    const url = isEdit ? `/api/locations/${locationId}` : "/api/locations";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), kind, parentLocationId: parentLocationId || null }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        title: isEdit ? "Update failed" : "Could not add location",
        description: data.error ?? "Please try again.",
      });
      setBusy(false);
      return;
    }

    toast({
      title: isEdit ? "Location updated" : "Location added",
      description: name.trim(),
    });
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(3,10,10,0.8)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-t-[var(--radius-card)] p-6 sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isEdit ? "Edit location" : "Add location"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
            style={{ color: "var(--color-text-mid)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <label className="flex flex-col gap-1.5">
            <span className="micro-label">Name</span>
            <div
              className="rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(6,17,17,0.6)",
              }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Workshop, Van 3, Tool Room"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                style={{ color: "var(--color-text-hi)" }}
                autoFocus
                required
              />
            </div>
          </label>

          {/* Kind */}
          <label className="flex flex-col gap-1.5">
            <span className="micro-label">Type</span>
            <div
              className="flex gap-1 rounded-full p-1"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {(["site", "room", "vehicle"] as const).map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium capitalize transition-all"
                    style={{
                      background: kind === k ? "var(--color-teal)" : "transparent",
                      color: kind === k ? "#04211d" : "var(--color-text-mid)",
                    }}
                  >
                    <Icon size={13} /> {k}
                  </button>
                );
              })}
            </div>
          </label>

          {/* Parent location (for nesting — e.g. a van "at" Tuas) */}
          <label className="flex flex-col gap-1.5">
            <span className="micro-label">Parent location (optional)</span>
            <div
              className="rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(6,17,17,0.6)",
              }}
            >
              <select
                value={parentLocationId}
                onChange={(e) => setParentLocationId(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              >
                <option value="" style={{ background: "var(--color-bg-1)" }}>
                  None — top-level
                </option>
                {eligibleParents.map((l) => (
                  <option key={l.id} value={l.id} style={{ background: "var(--color-bg-1)" }}>
                    {l.name}{l.parentName ? ` (at ${l.parentName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>
              For vehicles or rooms that are inside a site
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
                <Plus size={16} />
              )}
              {isEdit ? "Save changes" : "Add location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Recursive Location Tree Node (renders to any depth) ─────────────────
function LocationTreeNode({
  loc,
  childrenByParent,
  depth,
  onTapLocation,
  onTapHome,
  onEdit,
  onDelete,
  isAdmin,
}: {
  loc: LocationData;
  childrenByParent: Map<string, LocationData[]>;
  depth: number;
  onTapLocation: (loc: LocationData) => void;
  onTapHome: (loc: LocationData) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  isAdmin: boolean;
}) {
  const children = childrenByParent.get(loc.id) ?? [];

  return (
    <div className="space-y-2">
      <LocationCard
        loc={loc}
        onTapLocation={onTapLocation}
        onTapHome={onTapHome}
        onEdit={() => onEdit(loc.id)}
        onDelete={onDelete}
        isAdmin={isAdmin}
      />
      {children.length > 0 && (
        <div
          className="space-y-2 border-l pl-3"
          style={{
            borderColor: "var(--color-border)",
            marginLeft: depth > 0 ? 16 : 16,
          }}
        >
          {children.map((child) => (
            <LocationTreeNode
              key={child.id}
              loc={child}
              childrenByParent={childrenByParent}
              depth={depth + 1}
              onTapLocation={onTapLocation}
              onTapHome={onTapHome}
              onEdit={onEdit}
              onDelete={onDelete}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Location Card (extracted for hierarchy rendering) ───────────────────
function LocationCard({
  loc,
  onTapLocation,
  onTapHome,
  onEdit,
  onDelete,
  isAdmin,
}: {
  loc: LocationData;
  onTapLocation: (loc: LocationData) => void;
  onTapHome: (loc: LocationData) => void;
  onEdit: () => void;
  onDelete: (id: string, name: string) => void;
  isAdmin: boolean;
}) {
  const Icon = KIND_ICON[loc.kind] ?? MapPin;
  return (
    <div className="glass-card overflow-hidden">
      {/* Main tap target — "currently here" */}
      <button
        onClick={() => onTapLocation(loc)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[rgba(25,227,196,0.04)]"
      >
        <span
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            border: "1px solid rgba(25,227,196,0.3)",
            background: "rgba(14,79,74,0.3)",
            color: "var(--color-teal)",
            boxShadow: loc.itemCount > 0 ? "0 0 12px rgba(25,227,196,0.15)" : "none",
          }}
        >
          <Icon size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--color-text-hi)" }}
          >
            {loc.name}
          </p>
          <p className="micro-label mt-0.5">
            {loc.kind}
            {loc.parentName ? ` · at ${loc.parentName}` : ""}
            {loc.childrenCount > 0 ? ` · ${loc.childrenCount} child${loc.childrenCount === 1 ? "" : "ren"}` : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span
            className="font-display text-lg font-semibold"
            style={{ color: "var(--color-teal)" }}
          >
            {loc.itemCount}
          </span>
          <span className="micro-label">here now</span>
        </div>
      </button>

      {/* Home + away tracking section */}
      {loc.homeItemCount > 0 && (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            onClick={() => onTapHome(loc)}
            className="flex w-full items-center gap-2 text-left transition-colors hover:text-[var(--color-teal)]"
          >
            <Home size={13} style={{ color: "var(--color-gold)" }} />
            <span className="text-xs" style={{ color: "var(--color-text-mid)" }}>
              {loc.homeItemCount} {loc.homeItemCount === 1 ? "item" : "items"} call this home
            </span>
            {loc.awayCount > 0 && (
              <span
                className="ml-auto flex items-center gap-1 text-[10px] font-semibold"
                style={{ color: "var(--color-gold)" }}
              >
                <LogOut size={10} /> {loc.awayCount} away
              </span>
            )}
            <ArrowRight size={12} style={{ color: "var(--color-text-low)" }} />
          </button>

          {loc.awayCount > 0 && loc.awayBreakdown.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {loc.awayBreakdown.slice(0, 4).map((away) => (
                <span
                  key={away.location}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: "rgba(201,160,99,0.1)",
                    color: "var(--color-gold)",
                    border: "1px solid rgba(201,160,99,0.2)",
                  }}
                >
                  {away.location} · {away.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category breakdown bar */}
      {loc.directItemCount > 0 && loc.topCategories.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(6,17,17,0.6)" }}>
            {loc.topCategories.map((cat, i) => (
              <div
                key={cat.name}
                style={{
                  width: `${(cat.count / loc.directItemCount) * 100}%`,
                  background:
                    i === 0
                      ? "var(--color-teal)"
                      : i === 1
                      ? "var(--color-teal-deep)"
                      : i === 2
                      ? "var(--color-gold)"
                      : "var(--color-text-low)",
                }}
                title={`${cat.name}: ${cat.count}`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {loc.topCategories.slice(0, 3).map((cat) => (
              <span key={cat.name} className="text-[10px]" style={{ color: "var(--color-text-low)" }}>
                {cat.name} · {cat.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Edit/Delete actions — admin only */}
      {isAdmin && (
      <div className="flex border-t" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors hover:bg-[rgba(25,227,196,0.06)]"
          style={{ color: "var(--color-text-mid)" }}
        >
          <Pencil size={13} /> Edit
        </button>
        <div className="w-px" style={{ background: "var(--color-border)" }} />
        <button
          onClick={() => onDelete(loc.id, loc.name)}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors hover:bg-[rgba(224,86,107,0.08)]"
          style={{ color: "var(--color-danger)" }}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>
      )}
    </div>
  );
}
