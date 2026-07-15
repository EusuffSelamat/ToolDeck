"use client";

import { LayoutDashboard, TrendingUp, AlertTriangle, Boxes, CheckCircle2 } from "lucide-react";

const STAT_SKELETONS = [
  { label: "Total items", icon: Boxes },
  { label: "Available", icon: CheckCircle2 },
  { label: "Checked out", icon: TrendingUp },
  { label: "Needs service", icon: AlertTriangle },
  { label: "Low stock", icon: AlertTriangle },
];

/**
 * M1 Dashboard placeholder. Real dashboard (§9) lands in M6 — stat pills,
 * category radar, locations panel, needs-attention list, activity feed.
 */
export function DashboardView() {
  return (
    <div className="px-5 pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="micro-label mt-1">Live overview</p>
      </div>

      {/* stat pills row (skeleton) */}
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
        {STAT_SKELETONS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="glass-card flex min-w-[120px] flex-col gap-2 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="micro-label">{s.label}</span>
                <Icon size={13} style={{ color: "var(--color-text-low)" }} />
              </div>
              <span
                className="font-display text-3xl font-semibold"
                style={{ color: "var(--color-text-low)" }}
              >
                —
              </span>
            </div>
          );
        })}
      </div>

      {/* category radar placeholder */}
      <div className="glass-card mt-4 flex flex-col items-center gap-3 px-6 py-8">
        <span className="micro-label">By category</span>
        <div
          className="flex h-40 w-40 items-center justify-center rounded-full"
          style={{
            border: "1px solid var(--color-border)",
            background:
              "radial-gradient(circle, rgba(14,79,74,0.4) 0%, transparent 70%)",
          }}
        >
          <LayoutDashboard size={28} style={{ color: "var(--color-text-low)" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-low)" }}>
          Radar populates with real data in Milestone 6.
        </p>
      </div>

      {/* needs attention placeholder */}
      <div className="glass-card mt-4 px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="num-chip">!</span>
          <span className="micro-label">Needs attention</span>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
          Overdue returns, low stock, and upcoming maintenance will surface here.
        </p>
      </div>

      <p
        className="mt-6 text-center text-xs"
        style={{ color: "var(--color-text-low)" }}
      >
        Every number here reconciles with the database in Milestone 6.
      </p>
    </div>
  );
}
