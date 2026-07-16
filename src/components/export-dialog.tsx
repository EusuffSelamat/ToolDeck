"use client";

import { useState } from "react";
import { X, Loader2, FileSpreadsheet, Filter, Database, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateThemedExport, buildExportFilename, type ExportData } from "@/lib/themed-export";

export function ExportDialog({
  itemCount,
  filterDescription,
  filterQueryString,
  onClose,
}: {
  itemCount: number;
  filterDescription: string;
  filterQueryString: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"filtered" | "all">("filtered");

  async function handleExport() {
    setBusy(true);
    try {
      // Fetch items (filtered or all) — use export=true to raise the API cap
      const itemsQuery = scope === "filtered"
        ? (filterQueryString ? `${filterQueryString}&export=true&limit=5000` : "export=true&limit=5000")
        : "export=true&limit=5000";
      const [itemsRes, locationsRes, transactionsRes, statsRes] = await Promise.all([
        fetch(`/api/items?${itemsQuery}`),
        fetch("/api/locations"),
        fetch("/api/transactions?limit=10000"),
        fetch("/api/stats"),
      ]);

      if (!itemsRes.ok || !locationsRes.ok || !transactionsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch export data");
      }

      const [itemsData, locationsData, transactionsData, statsData] = await Promise.all([
        itemsRes.json(),
        locationsRes.json(),
        transactionsRes.json(),
        statsRes.json(),
      ]);

      // Fetch full item details (including notes) — the list API doesn't return notes
      const itemsWithDetails = await Promise.all(
        (itemsData.items as Array<{ id: string }>).map(async (item) => {
          const res = await fetch(`/api/items/${item.id}`);
          if (!res.ok) return null;
          const data = await res.json();
          return data.item;
        })
      );

      // Merge list data with detail data (notes, etc.)
      const mergedItems = itemsData.items.map((item: any, i: number) => ({
        ...item,
        notes: itemsWithDetails[i]?.notes ?? null,
        serialNo: itemsWithDetails[i]?.serialNo ?? null,
      }));

      const exportData: ExportData = {
        items: mergedItems,
        locations: locationsData.locations,
        transactions: transactionsData.transactions,
        stats: statsData,
        filterDescription: scope === "filtered" ? filterDescription : "All items",
      };

      const filterName = scope === "filtered"
        ? sanitizeFilterName(filterDescription)
        : "all";

      const filename = buildExportFilename(filterName);
      await generateThemedExport(exportData, filename);

      toast({
        title: "Export complete",
        description: `${mergedItems.length} items exported to ${filename}`,
      });
      onClose();
    } catch (e) {
      console.error("Export failed:", e);
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate the Excel file.",
      });
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(3,10,10,0.8)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-t-[var(--radius-card)] p-5 sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} style={{ color: "var(--color-teal)" }} />
            <h2 className="text-lg font-bold">Export to Excel</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
            style={{ color: "var(--color-text-mid)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm" style={{ color: "var(--color-text-mid)" }}>
          Generates a themed 4-sheet workbook (Summary, Items, Locations, Activity)
          with dark teal styling, color-coded statuses, and clickable photo links.
        </p>

        {/* Scope selection */}
        <div className="space-y-2">
          <button
            onClick={() => setScope("filtered")}
            className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all ${
              scope === "filtered" ? "glass-selected" : ""
            }`}
            style={
              scope === "filtered"
                ? undefined
                : { border: "1px solid var(--color-border)" }
            }
          >
            <Filter
              size={18}
              className="mt-0.5 flex-shrink-0"
              style={{ color: scope === "filtered" ? "var(--color-gold)" : "var(--color-teal)" }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                Current filter
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                {filterDescription} · {itemCount} items
              </p>
            </div>
            {scope === "filtered" && (
              <Check size={16} style={{ color: "var(--color-gold)" }} />
            )}
          </button>

          <button
            onClick={() => setScope("all")}
            className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all ${
              scope === "all" ? "glass-selected" : ""
            }`}
            style={
              scope === "all"
                ? undefined
                : { border: "1px solid var(--color-border)" }
            }
          >
            <Database
              size={18}
              className="mt-0.5 flex-shrink-0"
              style={{ color: scope === "all" ? "var(--color-gold)" : "var(--color-teal)" }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                All items
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                Export every active item in the database
              </p>
            </div>
            {scope === "all" && (
              <Check size={16} style={{ color: "var(--color-gold)" }} />
            )}
          </button>
        </div>

        {/* Export info */}
        <div
          className="mt-4 rounded-xl p-3"
          style={{
            background: "rgba(14,79,74,0.2)",
            border: "1px solid rgba(25,227,196,0.15)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
            <span style={{ color: "var(--color-teal)", fontWeight: 600 }}>4 sheets:</span>{" "}
            Dashboard Summary · Items (grouped by location) · Locations · Activity Log
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-low)" }}>
            Photos included as clickable links. Status cells color-coded.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="btn-ghost-teal flex-1 h-11 text-sm"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            className="btn-teal flex-[2] h-11 flex items-center justify-center gap-2 text-sm"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                Export Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function sanitizeFilterName(desc: string): string {
  // Convert filter description to a filename-safe string
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "filtered";
}
