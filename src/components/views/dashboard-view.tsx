"use client";

import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Boxes,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Package,
  Clock,
  ArrowRight,
  Calendar,
  MapPin,
  Building2,
  DoorOpen,
  Truck,
} from "lucide-react";
import { useHashRoute, type Route } from "@/hooks/use-hash-route";
import { setLocationFilter } from "@/lib/location-filter";

type Stats = {
  totalItems: number;
  available: number;
  checkedOut: number;
  needsService: number;
  outOfOrder: number;
  lowStock: number;
  overdueReturns: number;
  overdueItems: Array<{
    id: string;
    code: string;
    name: string;
    expectedReturnDate: string;
    holder: { fullName: string } | null;
  }>;
  byCategory: Array<{ name: string; count: number }>;
  byLocation: Array<{ id: string; name: string; kind: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    note: string | null;
    createdAt: string;
    itemCode: string | null;
    itemName: string | null;
    itemId: string | null;
    personName: string | null;
  }>;
};

const STAT_DEFS = [
  { key: "totalItems" as const, label: "Total", icon: Boxes, color: "var(--color-teal)" },
  { key: "available" as const, label: "Available", icon: CheckCircle2, color: "var(--color-teal)" },
  { key: "checkedOut" as const, label: "Checked out", icon: TrendingUp, color: "var(--color-gold)" },
  { key: "needsService" as const, label: "Needs service", icon: AlertTriangle, color: "var(--color-magenta)" },
  { key: "lowStock" as const, label: "Low stock", icon: AlertTriangle, color: "var(--color-magenta)" },
];

// Donut chart colours — teal spectrum + gold for contrast
const DONUT_COLORS = [
  "#19E3C4",
  "#0E4F4A",
  "#6BFFE9",
  "#C9A063",
  "#E06FB2",
  "#9FBDB8",
  "#6E8D89",
];

const KIND_ICON: Record<string, typeof Building2> = {
  site: Building2,
  room: DoorOpen,
  vehicle: Truck,
};

export function DashboardView() {
  const [route, navigate] = useHashRoute();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json() as Promise<Stats>;
    },
    staleTime: 10_000,
  });

  return (
    <div className="px-5 pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="micro-label mt-1">Live overview</p>
      </div>

      {/* Row 1 — Stat pills */}
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
        {STAT_DEFS.map((s) => {
          const Icon = s.icon;
          const value = stats ? stats[s.key] : null;
          return (
            <div
              key={s.key}
              className="glass-card flex min-w-[120px] flex-col gap-2 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="micro-label">{s.label}</span>
                <Icon size={13} style={{ color: s.color }} />
              </div>
              <span
                className="font-display text-3xl font-semibold"
                style={{ color: value !== null ? s.color : "var(--color-text-low)" }}
              >
                {value ?? "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Overdue returns alert */}
      {stats && stats.overdueReturns > 0 && (
        <button
          onClick={() => navigate({ name: "items" })}
          className="glass-card mt-4 flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-[rgba(224,86,107,0.4)]"
          style={{ borderColor: "rgba(224,86,107,0.25)" }}
        >
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
              background: "rgba(224,86,107,0.1)",
            }}
          >
            <Calendar size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--color-danger)" }}>
              {stats.overdueReturns} overdue {stats.overdueReturns === 1 ? "return" : "returns"}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
              {stats.overdueItems[0]?.code} · {stats.overdueItems[0]?.name}
              {stats.overdueItems[0]?.holder ? ` · ${stats.overdueItems[0].holder.fullName}` : ""}
            </p>
          </div>
          <ArrowRight size={16} style={{ color: "var(--color-text-low)" }} />
        </button>
      )}

      {/* Row 2 — Category radar (donut chart) */}
      {stats && stats.byCategory.length > 0 && (
        <div className="glass-card mt-4 p-4">
          <span className="micro-label mb-3 block">By category</span>
          <div className="flex items-center gap-4">
            {/* Donut chart with total in centre */}
            <div className="relative h-36 w-36 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.byCategory}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {stats.byCategory.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centre label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="font-display text-2xl font-bold"
                  style={{ color: "var(--color-teal)" }}
                >
                  {stats.totalItems}
                </span>
                <span className="micro-label">items</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-1.5">
              {stats.byCategory.slice(0, 6).map((cat, i) => (
                <button
                  key={cat.name}
                  onClick={() => navigate({ name: "items" })}
                  className="flex w-full items-center gap-2 text-left transition-colors hover:bg-[rgba(25,227,196,0.04)] rounded-lg px-1.5 py-0.5"
                >
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span
                    className="flex-1 truncate text-xs"
                    style={{ color: "var(--color-text-mid)" }}
                  >
                    {cat.name}
                  </span>
                  <span
                    className="font-display text-xs font-semibold"
                    style={{ color: "var(--color-text-hi)" }}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Row 3 — Locations panel */}
      {stats && stats.byLocation.length > 0 && (
        <div className="glass-card mt-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MapPin size={14} style={{ color: "var(--color-text-low)" }} />
            <span className="micro-label">Locations</span>
          </div>
          <div className="space-y-2">
            {stats.byLocation.slice(0, 5).map((loc) => {
              const Icon = KIND_ICON[loc.kind] ?? MapPin;
              return (
                <button
                  key={loc.id}
                  onClick={() => {
                    setLocationFilter(loc.id, loc.name, "current");
                    navigate({ name: "items" });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-[rgba(25,227,196,0.04)]"
                >
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      border: "1px solid rgba(25,227,196,0.2)",
                      color: "var(--color-teal)",
                      background: "rgba(14,79,74,0.2)",
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <span
                    className="flex-1 truncate text-sm"
                    style={{ color: "var(--color-text-hi)" }}
                  >
                    {loc.name}
                  </span>
                  <span
                    className="font-display text-sm font-semibold"
                    style={{ color: "var(--color-teal)" }}
                  >
                    {loc.count}
                  </span>
                  <ArrowRight size={12} style={{ color: "var(--color-text-low)" }} />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => navigate({ name: "locations" })}
            className="mt-2 flex w-full items-center justify-center gap-1 text-xs transition-colors hover:text-[var(--color-teal)]"
            style={{ color: "var(--color-text-mid)" }}
          >
            View all locations <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Row 4 — Needs attention */}
      {stats && (stats.needsService > 0 || stats.lowStock > 0 || stats.overdueReturns > 0) && (
        <div className="glass-card mt-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="num-chip">!</span>
            <span className="micro-label">Needs attention</span>
          </div>
          <div className="space-y-2">
            {stats.overdueReturns > 0 && (
              <AttentionRow
                icon={Calendar}
                color="var(--color-danger)"
                label={`${stats.overdueReturns} overdue ${stats.overdueReturns === 1 ? "return" : "returns"}`}
                onClick={() => navigate({ name: "activity" })}
              />
            )}
            {stats.needsService > 0 && (
              <AttentionRow
                icon={AlertTriangle}
                color="var(--color-magenta)"
                label={`${stats.needsService} ${stats.needsService === 1 ? "item needs" : "items need"} service`}
                onClick={() => navigate({ name: "items" })}
              />
            )}
            {stats.lowStock > 0 && (
              <AttentionRow
                icon={Package}
                color="var(--color-magenta)"
                label={`${stats.lowStock} low-stock ${stats.lowStock === 1 ? "item" : "items"}`}
                onClick={() => navigate({ name: "items" })}
              />
            )}
          </div>
        </div>
      )}

      {/* Recent activity preview */}
      {stats && stats.recentActivity.length > 0 && (
        <div className="glass-card mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: "var(--color-text-low)" }} />
              <span className="micro-label">Recent activity</span>
            </div>
            <button
              onClick={() => navigate({ name: "activity" })}
              className="text-xs transition-colors hover:text-[var(--color-teal)]"
              style={{ color: "var(--color-text-mid)" }}
            >
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {stats.recentActivity.map((tx) => (
              <button
                key={tx.id}
                onClick={() => tx.itemId && navigate({ name: "item-detail", id: tx.itemId })}
                className="flex w-full items-center gap-2 text-left text-xs transition-colors hover:bg-[rgba(25,227,196,0.04)] rounded-lg px-1.5 py-1"
              >
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: getActionColor(tx.action) }}
                />
                <span style={{ color: "var(--color-text-mid)" }}>
                  <span style={{ color: "var(--color-text-hi)", fontWeight: 600 }}>
                    {tx.personName ?? "Someone"}
                  </span>{" "}
                  {formatActionShort(tx.action)}{" "}
                  {tx.itemCode && (
                    <span style={{ color: "var(--color-teal)" }}>{tx.itemCode}</span>
                  )}
                </span>
                <span className="ml-auto" style={{ color: "var(--color-text-low)" }}>
                  {formatTimeAgo(tx.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats && stats.totalItems === 0 && !isLoading && (
        <div className="glass-card mt-4 flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-teal)",
            }}
          >
            <Package size={24} />
          </span>
          <div>
            <p className="text-base font-medium" style={{ color: "var(--color-text-hi)" }}>
              No items yet
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
              Tap Scan to add your first tool.
            </p>
          </div>
          <button
            onClick={() => navigate({ name: "scan" })}
            className="btn-teal mt-1 flex h-10 items-center gap-2 px-5 text-sm"
          >
            Open Scan
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function AttentionRow({
  icon: Icon,
  color,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[rgba(25,227,196,0.04)]"
    >
      <Icon size={14} style={{ color }} />
      <span className="flex-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
        {label}
      </span>
      <ArrowRight size={14} style={{ color: "var(--color-text-low)" }} />
    </button>
  );
}

function getActionColor(action: string): string {
  switch (action) {
    case "add": return "var(--color-teal)";
    case "checkout": return "var(--color-gold)";
    case "checkin": return "var(--color-teal)";
    case "move": return "var(--color-teal)";
    case "adjust_qty": return "var(--color-teal-bright)";
    case "condition": return "var(--color-magenta)";
    case "edit": return "var(--color-text-low)";
    case "delete": return "var(--color-danger)";
    case "restore": return "var(--color-teal)";
    default: return "var(--color-text-low)";
  }
}

function formatActionShort(action: string): string {
  const map: Record<string, string> = {
    add: "added",
    checkout: "checked out",
    checkin: "returned",
    move: "moved",
    adjust_qty: "adjusted",
    condition: "updated",
    edit: "edited",
    delete: "deleted",
    restore: "restored",
    maintenance: "maintained",
  };
  return map[action] ?? action;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}
