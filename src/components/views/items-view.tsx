"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Package, X } from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { StatusPill, type ItemStatus } from "@/components/status-pill";

type FilterChip = {
  key: string;
  label: string;
  value: string;
};

const STATUS_CHIPS: FilterChip[] = [
  { key: "status", label: "Available", value: "available" },
  { key: "status", label: "Checked out", value: "checked_out" },
  { key: "status", label: "Needs service", value: "needs_service" },
  { key: "status", label: "Out of order", value: "out_of_order" },
];

const TYPE_CHIPS: FilterChip[] = [
  { key: "trackingType", label: "Assets", value: "asset" },
  { key: "trackingType", label: "Stock", value: "stock" },
];

const QUICK_CHIPS: FilterChip[] = [
  { key: "holder", label: "My items", value: "me" },
  { key: "lowStock", label: "Low stock", value: "true" },
];

export function ItemsView() {
  const [, navigate] = useHashRoute();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(id);
  }, [search]);

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    for (const f of activeFilters) {
      params.set(f.key, f.value);
    }
    return params.toString();
  }, [debouncedSearch, activeFilters]);

  const { data, isLoading } = useQuery({
    queryKey: ["items", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/items?${queryString}`);
      if (!res.ok) throw new Error("Failed to load items");
      return res.json() as Promise<{
        items: Array<{
          id: string;
          code: string;
          name: string;
          brand: string | null;
          model: string | null;
          trackingType: string;
          status: ItemStatus;
          condition: string;
          quantity: number;
          minQuantity: number;
          photoUrl: string | null;
          categoryName: string | null;
          currentLocationName: string | null;
          holderName: string | null;
        }>;
        total: number;
      }>;
    },
  });

  function toggleFilter(chip: FilterChip) {
    setActiveFilters((prev) => {
      // For same-key single-value filters (status, trackingType, holder, lowStock),
      // replace; allow multiple different keys
      const filtered = prev.filter((f) => f.key !== chip.key);
      const exists = prev.some(
        (f) => f.key === chip.key && f.value === chip.value
      );
      if (!exists) filtered.push(chip);
      return filtered;
    });
  }

  function isChipActive(chip: FilterChip) {
    return activeFilters.some(
      (f) => f.key === chip.key && f.value === chip.value
    );
  }

  function clearFilters() {
    setActiveFilters([]);
    setSearch("");
  }

  const items = data?.items ?? [];
  const hasAnyFilter = debouncedSearch || activeFilters.length > 0;

  return (
    <div className="px-5 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Items</h1>
          <p className="micro-label mt-1">
            {data ? `${data.total} total` : "Loading…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ name: "item-new" })}
          className="btn-teal flex h-10 items-center gap-1.5 px-4 text-sm"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Search bar */}
      <div
        className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
        style={{
          border: "1px solid var(--color-border)",
          background: "rgba(6,17,17,0.6)",
        }}
      >
        <Search size={16} style={{ color: "var(--color-text-low)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, brand, code…"
          aria-label="Search items"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
          style={{ color: "var(--color-text-hi)" }}
        />
        {hasAnyFilter && (
          <button
            onClick={clearFilters}
            aria-label="Clear filters"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
            style={{ color: "var(--color-text-low)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2">
        {STATUS_CHIPS.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            active={isChipActive(c)}
            onClick={() => toggleFilter(c)}
          />
        ))}
        {TYPE_CHIPS.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            active={isChipActive(c)}
            onClick={() => toggleFilter(c)}
          />
        ))}
        {QUICK_CHIPS.map((c) => (
          <Chip
            key={c.label}
            label={c.label}
            active={isChipActive(c)}
            onClick={() => toggleFilter(c)}
          />
        ))}
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-card h-20 animate-pulse"
              style={{ background: "rgba(10,26,26,0.3)" }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card mt-6 flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text-low)",
            }}
          >
            <Package size={24} />
          </span>
          <div>
            <p
              className="text-base font-medium"
              style={{ color: "var(--color-text-hi)" }}
            >
              {hasAnyFilter ? "No matches" : "No items yet"}
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--color-text-mid)" }}
            >
              {hasAnyFilter
                ? "Try a different search or clear filters."
                : "Tap Add or Scan to add your first."}
            </p>
          </div>
          {!hasAnyFilter && (
            <button
              onClick={() => navigate({ name: "item-new" })}
              className="btn-teal mt-1 flex h-10 items-center gap-2 px-5 text-sm"
            >
              <Plus size={15} /> Add item
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3 pb-2">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() =>
                navigate({ name: "item-detail", id: item.id })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all"
      style={{
        background: active ? "var(--color-teal)" : "rgba(6,17,17,0.6)",
        color: active ? "#04211d" : "var(--color-text-mid)",
        border: `1px solid ${active ? "var(--color-teal)" : "var(--color-border)"}`,
      }}
    >
      {label}
    </button>
  );
}

function ItemCard({
  item,
  onClick,
}: {
  item: {
    id: string;
    code: string;
    name: string;
    brand: string | null;
    model: string | null;
    trackingType: string;
    status: ItemStatus;
    photoUrl: string | null;
    categoryName: string | null;
    currentLocationName: string | null;
    holderName: string | null;
    quantity: number;
    minQuantity: number;
  };
  onClick: () => void;
}) {
  const isLowStock =
    item.trackingType === "stock" && item.quantity <= item.minQuantity;

  return (
    <button
      onClick={onClick}
      className="glass-card flex w-full items-center gap-3 p-3 text-left transition-all hover:border-[rgba(25,227,196,0.35)] active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{
          border: "1px solid var(--color-border)",
          background: "rgba(6,17,17,0.6)",
        }}
      >
        {item.photoUrl ? (
           
          <img
            src={item.photoUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package size={20} style={{ color: "var(--color-text-low)" }} />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="micro-label">{item.code}</span>
          {isLowStock && (
            <span
              className="text-[10px] font-semibold"
              style={{ color: "var(--color-magenta)" }}
            >
              LOW
            </span>
          )}
        </div>
        <p
          className="truncate text-sm font-medium"
          style={{ color: "var(--color-text-hi)" }}
        >
          {item.name}
        </p>
        <p
          className="truncate text-xs"
          style={{ color: "var(--color-text-mid)" }}
        >
          {item.brand ? `${item.brand} · ` : ""}
          {item.currentLocationName ?? "No location"}
          {item.holderName ? ` · ${item.holderName}` : ""}
        </p>
      </div>

      {/* Status pill */}
      <StatusPill status={item.status} className="flex-shrink-0" />
    </button>
  );
}
