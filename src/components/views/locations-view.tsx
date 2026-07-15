"use client";

import { MapPin, Plus } from "lucide-react";

/**
 * M1 Locations placeholder. Locations CRUD + category breakdown bars land in M2.
 */
export function LocationsView() {
  return (
    <div className="px-5 pt-4">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="micro-label mt-1">Where things live</p>
        </div>
        <button
          type="button"
          className="btn-ghost-teal flex h-9 w-9 items-center justify-center"
          aria-label="Add location"
        >
          <Plus size={16} />
        </button>
      </div>

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
            Sites, rooms, and vehicles appear here as glowing nodes.
          </p>
        </div>
      </div>

      <p
        className="mt-6 text-center text-xs"
        style={{ color: "var(--color-text-low)" }}
      >
        Location management and the constellation panel arrive in Milestone 2.
      </p>
    </div>
  );
}
