"use client";

import { Activity as ActivityIcon } from "lucide-react";

/**
 * M1 Activity placeholder. The reverse-chronological transaction feed
 * (§7.9) lands in M5.
 */
export function ActivityView() {
  return (
    <div className="px-5 pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="micro-label mt-1">Audit trail</p>
      </div>

      <div className="glass-card flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-text-low)",
          }}
        >
          <ActivityIcon size={24} />
        </span>
        <div>
          <p className="text-base font-medium" style={{ color: "var(--color-text-hi)" }}>
            Nothing has happened yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
            Every add, move, and check-out will appear here with who, what,
            where, and when.
          </p>
        </div>
      </div>

      <p
        className="mt-6 text-center text-xs"
        style={{ color: "var(--color-text-low)" }}
      >
        The live feed arrives in Milestone 5.
      </p>
    </div>
  );
}
