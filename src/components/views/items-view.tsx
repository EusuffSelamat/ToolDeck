"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Package, X, MapPin, ChevronDown, ArrowRight, Download, FileText, Sheet, FileSpreadsheet } from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { StatusPill, type ItemStatus } from "@/components/status-pill";
import { getLocationFilter, clearLocationFilter, type LocationFilterMode } from "@/lib/location-filter";
import { exportToCSV, exportToXLSX } from "@/lib/export";
import { ExportDialog } from "@/components/export-dialog";
import { useRole } from "@/hooks/use-role";
import { canManage, canOperate } from "@/lib/roles";

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
];

// Read the location filter once (before the component mounts)
function getInitialLocationFilter(): {
  filters: FilterChip[];
  name: string | null;
  mode: LocationFilterMode;
} {
  if (typeof window === "undefined") return { filters: [], name: null, mode: "current" };
  const lf = getLocationFilter();
  if (!lf) return { filters: [], name: null, mode: "current" };
  clearLocationFilter();
  const key = lf.mode === "home" ? "homeLocationId" : "locationId";
  return {
    filters: [{ key, label: lf.locationName, value: lf.locationId }],
    name: lf.locationName,
    mode: lf.mode,
  };
}

export function ItemsView() {
  const [, navigate] = useHashRoute();
  const role = useRole();
  const isAdmin = canManage(role); // admin or manager
  const canAct = canOperate(role); // worker and above — viewers are read-only
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const initial = useMemo(() => getInitialLocationFilter(), []);
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>(initial.filters);
  const [locationFilterName, setLocationFilterName] = useState<string | null>(initial.name);
  const [locationFilterMode, setLocationFilterMode] = useState<LocationFilterMode>(initial.mode);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Fetch locations for the picker (cached, shared with Locations view)
  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to load locations");
      return res.json() as Promise<{
        locations: Array<{ id: string; name: string; kind: string; itemCount: number }>;
      }>;
    },
  });

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
          photoUrl: string | null;
          categoryName: string | null;
          homeLocationId: string | null;
          currentLocationId: string | null;
          currentLocationName: string | null;
          homeLocationName: string | null;
          holderId: string | null;
          holderName: string | null;
          expectedReturnDate: string | null;
          updatedAt: string;
        }>;
        total: number;
      }>;
    },
  });

  function toggleFilter(chip: FilterChip) {
    setActiveFilters((prev) => {
      // For same-key single-value filters (status, trackingType, holder),
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
    setLocationFilterName(null);
  }

  function selectLocation(loc: { id: string; name: string }) {
    const key = locationFilterMode === "home" ? "homeLocationId" : "locationId";
    setActiveFilters((prev) => {
      const filtered = prev.filter(
        (f) => f.key !== "locationId" && f.key !== "homeLocationId"
      );
      filtered.push({ key, label: loc.name, value: loc.id });
      return filtered;
    });
    setLocationFilterName(loc.name);
    setShowLocationPicker(false);
  }

  function removeLocationFilter() {
    setActiveFilters((prev) =>
      prev.filter((f) => f.key !== "locationId" && f.key !== "homeLocationId")
    );
    setLocationFilterName(null);
  }

  function toggleLocationFilterMode() {
    const newMode: LocationFilterMode =
      locationFilterMode === "current" ? "home" : "current";
    setLocationFilterMode(newMode);
    // Swap the filter key
    setActiveFilters((prev) => {
      const existing = prev.find(
        (f) => f.key === "locationId" || f.key === "homeLocationId"
      );
      if (!existing) return prev;
      const filtered = prev.filter(
        (f) => f.key !== "locationId" && f.key !== "homeLocationId"
      );
      filtered.push({
        key: newMode === "home" ? "homeLocationId" : "locationId",
        label: existing.label,
        value: existing.value,
      });
      return filtered;
    });
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
        <div className="flex items-center gap-2">
          {/* Export dropdown — available to every role, viewers included */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!data || data.items.length === 0}
              className="btn-ghost-teal flex h-10 w-10 items-center justify-center disabled:opacity-40"
              aria-label="Export"
            >
              <Download size={16} />
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <div
                  className="glass-strong absolute right-0 top-12 z-50 w-52 rounded-xl p-2"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <button
                    onClick={() => {
                      setShowExportDialog(true);
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(25,227,196,0.06)]"
                    style={{ color: "var(--color-text-hi)" }}
                  >
                    <FileSpreadsheet size={15} style={{ color: "var(--color-teal)" }} />
                    <div>
                      <div>Themed Excel</div>
                      <div className="text-[10px]" style={{ color: "var(--color-text-low)" }}>
                        3 sheets + photos
                      </div>
                    </div>
                  </button>
                  <div className="my-1 h-px" style={{ background: "var(--color-border)" }} />
                  <button
                    onClick={() => {
                      exportToCSV(items, "tooldeck-items");
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(25,227,196,0.06)]"
                    style={{ color: "var(--color-text-hi)" }}
                  >
                    <FileText size={15} style={{ color: "var(--color-teal)" }} />
                    CSV (quick)
                  </button>
                  <button
                    onClick={() => {
                      exportToXLSX(items, "tooldeck-items");
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[rgba(25,227,196,0.06)]"
                    style={{ color: "var(--color-text-hi)" }}
                  >
                    <Sheet size={15} style={{ color: "var(--color-teal)" }} />
                    Excel (plain)
                  </button>
                </div>
              </>
            )}
          </div>
          {canAct && (
            <button
              type="button"
              onClick={() => navigate({ name: "item-new" })}
              className="btn-teal flex h-10 items-center gap-1.5 px-4 text-sm"
            >
              <Plus size={16} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Location filter banner (when a location filter is active) */}
      {locationFilterName && (
        <div
          className="mb-3 rounded-xl px-3 py-2.5"
          style={{
            background: "rgba(14,79,74,0.3)",
            border: "1px solid rgba(25,227,196,0.25)",
          }}
        >
          <div className="flex items-center gap-2">
            <MapPin size={14} style={{ color: "var(--color-teal)" }} />
            <span className="flex-1 text-sm" style={{ color: "var(--color-text-hi)" }}>
              {locationFilterName}
            </span>
            <button
              onClick={removeLocationFilter}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.1)]"
              style={{ color: "var(--color-text-mid)" }}
              aria-label="Remove location filter"
            >
              <X size={13} />
            </button>
          </div>
          {/* Current vs Home toggle */}
          <div
            className="mt-2 flex gap-1 rounded-full p-0.5"
            style={{ background: "rgba(3,10,10,0.5)" }}
          >
            <button
              onClick={() => {
                if (locationFilterMode !== "current") toggleLocationFilterMode();
              }}
              className="flex-1 rounded-full py-1.5 text-xs font-medium transition-all"
              style={{
                background:
                  locationFilterMode === "current"
                    ? "var(--color-teal)"
                    : "transparent",
                color:
                  locationFilterMode === "current"
                    ? "#04211d"
                    : "var(--color-text-mid)",
              }}
            >
              Currently here
            </button>
            <button
              onClick={() => {
                if (locationFilterMode !== "home") toggleLocationFilterMode();
              }}
              className="flex-1 rounded-full py-1.5 text-xs font-medium transition-all"
              style={{
                background:
                  locationFilterMode === "home"
                    ? "var(--color-teal)"
                    : "transparent",
                color:
                  locationFilterMode === "home"
                    ? "#04211d"
                    : "var(--color-text-mid)",
              }}
            >
              Calls this home
            </button>
          </div>
        </div>
      )}

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
        {/* Location picker chip */}
        <button
          type="button"
          onClick={() => setShowLocationPicker(true)}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all"
          style={{
            background: locationFilterName
              ? "rgba(14,79,74,0.4)"
              : "rgba(6,17,17,0.6)",
            color: locationFilterName
              ? "var(--color-teal)"
              : "var(--color-text-mid)",
            border: `1px solid ${
              locationFilterName ? "rgba(25,227,196,0.5)" : "var(--color-border)"
            }`,
          }}
        >
          <MapPin size={12} />
          {locationFilterName ?? "Location"}
          <ChevronDown size={12} />
        </button>

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
                : canAct
                ? "Tap Add or Scan to add your first."
                : "Nothing has been added yet."}
            </p>
          </div>
          {!hasAnyFilter && canAct && (
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

      {/* Location picker sheet */}
      {showLocationPicker && (
        <LocationPickerSheet
          locations={locationsData?.locations ?? []}
          selectedId={
            activeFilters.find(
              (f) => f.key === "locationId" || f.key === "homeLocationId"
            )?.value ?? null
          }
          onSelect={selectLocation}
          onClear={removeLocationFilter}
          onViewAll={() => {
            setShowLocationPicker(false);
            navigate({ name: "locations" });
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      {/* Export dialog */}
      {showExportDialog && (
        <ExportDialog
          itemCount={items.length}
          filterDescription={(() => {
            if (!hasAnyFilter) return "All items";
            const parts: string[] = [];
            if (debouncedSearch) parts.push(`"${debouncedSearch}"`);
            for (const f of activeFilters) {
              if (f.key === "status") parts.push(f.label);
              else if (f.key === "trackingType") parts.push(f.label);
              else if (f.key === "holder") parts.push("my items");
              else if (f.key === "locationId" || f.key === "homeLocationId") parts.push(locationFilterName ?? f.label);
            }
            return parts.length > 0 ? parts.join(" · ") : "All items";
          })()}
          filterQueryString={queryString}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}

// ── Location Picker Sheet ───────────────────────────────────────────────
function LocationPickerSheet({
  locations,
  selectedId,
  onSelect,
  onClear,
  onViewAll,
  onClose,
}: {
  locations: Array<{ id: string; name: string; kind: string; itemCount: number }>;
  selectedId: string | null;
  onSelect: (loc: { id: string; name: string }) => void;
  onClear: () => void;
  onViewAll: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(3,10,10,0.8)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-t-[var(--radius-card)] p-5 sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--color-border)", maxHeight: "70vh", overflowY: "auto" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Filter by location</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
            style={{ color: "var(--color-text-mid)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {locations.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--color-text-mid)" }}>
            No locations yet. Add some in the Locations tab.
          </p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => {
              const active = loc.id === selectedId;
              return (
                <button
                  key={loc.id}
                  onClick={() => onSelect({ id: loc.id, name: loc.name })}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${
                    active ? "glass-selected" : "hover:bg-[rgba(25,227,196,0.04)]"
                  }`}
                  style={
                    active
                      ? undefined
                      : { border: "1px solid var(--color-border)" }
                  }
                >
                  <MapPin
                    size={16}
                    style={{ color: active ? "var(--color-gold)" : "var(--color-teal)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--color-text-hi)" }}
                    >
                      {loc.name}
                    </p>
                    <p className="micro-label mt-0.5">
                      {loc.kind} · {loc.itemCount} {loc.itemCount === 1 ? "item" : "items"}
                    </p>
                  </div>
                  {active && (
                    <span style={{ color: "var(--color-gold)" }}>
                      <ChevronDown size={16} className="rotate-180" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div
          className="mt-4 flex gap-3 border-t pt-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          {selectedId && (
            <button
              onClick={onClear}
              className="btn-ghost-teal flex-1 h-10 text-sm"
            >
              Clear filter
            </button>
          )}
          <button
            onClick={onViewAll}
            className="btn-ghost-teal flex-1 h-10 flex items-center justify-center gap-1.5 text-sm"
          >
            View all locations <ArrowRight size={14} />
          </button>
        </div>
      </div>
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
    homeLocationId: string | null;
    currentLocationId: string | null;
    currentLocationName: string | null;
    homeLocationName: string | null;
    holderId: string | null;
    holderName: string | null;
    quantity: number;
  };
  onClick: () => void;
}) {
  // "Away from home" = home is set, and either current differs from home,
  // or the item is checked out (holder set)
  const isAwayFromHome =
    item.homeLocationId !== null &&
    (item.currentLocationId !== item.homeLocationId || item.holderId !== null);

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
          {item.holderName
            ? `Checked out by ${item.holderName}`
            : item.currentLocationName ?? "No location"}
        </p>
        {/* Away-from-home tracking line */}
        {isAwayFromHome && item.homeLocationName && (
          <p
            className="truncate text-[10px]"
            style={{ color: "var(--color-gold)" }}
          >
            Home: {item.homeLocationName}
          </p>
        )}
      </div>

      {/* Status pill */}
      <StatusPill status={item.status} className="flex-shrink-0" />
    </button>
  );
}
