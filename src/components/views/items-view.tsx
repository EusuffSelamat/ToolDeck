"use client";

import { Package, ArrowRight } from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";

/**
 * M1 Items placeholder. The real list (search, filters, cards) lands in M3.
 * Empty-state voice per §7: "No items yet — tap Scan to add your first."
 */
export function ItemsView() {
  const [, navigate] = useHashRoute();

  return (
    <div className="px-5 pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Items</h1>
        <p className="micro-label mt-1">Inventory catalogue</p>
      </div>

      <div
        className="glass-card flex flex-col items-center gap-4 px-6 py-12 text-center"
      >
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
          <p className="text-base font-medium" style={{ color: "var(--color-text-hi)" }}>
            No items yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
            Tap Scan to add your first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate({ name: "scan" })}
          className="btn-teal mt-1 flex h-10 items-center gap-2 px-5 text-sm"
        >
          Open Scan <ArrowRight size={15} />
        </button>
      </div>

      <p
        className="mt-6 text-center text-xs"
        style={{ color: "var(--color-text-low)" }}
      >
        Search, filters, and item detail arrive in Milestone 3.
      </p>
    </div>
  );
}
