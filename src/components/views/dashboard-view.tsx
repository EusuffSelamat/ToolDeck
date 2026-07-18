"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Wrench,
  UserCheck,
  Users,
  Check,
  X,
  Loader2,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useHashRoute, type Route } from "@/hooks/use-hash-route";
import { setLocationFilter } from "@/lib/location-filter";
import { useRole } from "@/hooks/use-role";
import { canOperate } from "@/lib/roles";
import { useToast } from "@/hooks/use-toast";

type Stats = {
  totalItems: number;
  available: number;
  checkedOut: number;
  needsService: number;
  outOfOrder: number;
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
    itemIsDeleted: boolean;
    personName: string | null;
  }>;
  maintenanceDueSoon: Array<{
    id: string;
    nextDue: string;
    description: string;
    itemId: string;
    itemCode: string;
    itemName: string;
  }>;
};

const STAT_DEFS = [
  { key: "totalItems" as const, label: "Total", icon: Boxes, color: "var(--color-teal)" },
  { key: "available" as const, label: "Available", icon: CheckCircle2, color: "var(--color-teal)" },
  { key: "checkedOut" as const, label: "Checked out", icon: TrendingUp, color: "var(--color-gold)" },
  { key: "needsService" as const, label: "Needs service", icon: AlertTriangle, color: "var(--color-magenta)" },
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
  const viewerRole = useRole();

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

      {/* Pending approvals — admin only */}
      <PendingApprovals />

      {/* All registered accounts + role management — admin only */}
      <AccountsPanel />

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
      {stats && (stats.needsService > 0 || stats.overdueReturns > 0) && (
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
            {stats.maintenanceDueSoon.length > 0 && (
              <AttentionRow
                icon={Wrench}
                color="var(--color-magenta)"
                label={`${stats.maintenanceDueSoon.length} maintenance ${stats.maintenanceDueSoon.length === 1 ? "item" : "items"} due soon`}
                onClick={() => navigate({ name: "item-detail", id: stats.maintenanceDueSoon[0].itemId })}
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
              {canOperate(viewerRole)
                ? "Tap Scan to add your first tool."
                : "Nothing has been added yet."}
            </p>
          </div>
          {canOperate(viewerRole) && (
            <button
              onClick={() => navigate({ name: "scan" })}
              className="btn-teal mt-1 flex h-10 items-center gap-2 px-5 text-sm"
            >
              Open Scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pending approvals (admin only) ──────────────────────────────────────
type PendingUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  approvalStatus: string;
  createdAt: string;
};

function PendingApprovals() {
  const role = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [actingId, setActingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?status=pending");
      if (!res.ok) throw new Error("Failed to load pending users");
      return res.json() as Promise<{ users: PendingUser[] }>;
    },
    enabled: role === "admin",
    refetchInterval: 30_000,
  });

  // Only admins see this panel at all.
  if (role !== "admin") return null;

  const users = data?.users ?? [];

  // Hide the panel entirely when there's nothing to review (once loaded).
  if (!isLoading && users.length === 0) return null;

  async function act(id: string, action: "approve" | "reject", name: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Action failed", description: err.error ?? "Please try again." });
        return;
      }
      toast({
        title: action === "approve" ? "Account approved" : "Account rejected",
        description: name,
      });
      qc.invalidateQueries({ queryKey: ["pending-users"] });
    } catch {
      toast({ title: "Action failed", description: "Please try again." });
    } finally {
      setActingId(null);
    }
  }

  return (
    <div
      className="glass-card mb-4 p-4"
      style={{ borderColor: "rgba(201,160,99,0.35)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <UserCheck size={14} style={{ color: "var(--color-gold)" }} />
        <span className="micro-label">Pending approvals</span>
        {users.length > 0 && (
          <span className="micro-label" style={{ color: "var(--color-gold)" }}>
            · {users.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-low)" }} />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const busy = actingId === u.id;
            return (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-xl p-2"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
                  style={{
                    border: "1px solid rgba(201,160,99,0.4)",
                    color: "var(--color-gold)",
                    background: "rgba(201,160,99,0.12)",
                  }}
                >
                  {u.fullName?.[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--color-text-hi)" }}
                  >
                    {u.fullName}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--color-text-low)" }}>
                    {u.email}
                  </p>
                </div>
                <button
                  onClick={() => act(u.id, "approve", u.fullName)}
                  disabled={busy}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 hover:bg-[rgba(25,227,196,0.12)]"
                  style={{
                    border: "1px solid rgba(25,227,196,0.4)",
                    color: "var(--color-teal)",
                  }}
                  aria-label={`Approve ${u.fullName}`}
                  title="Allow"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
                </button>
                <button
                  onClick={() => act(u.id, "reject", u.fullName)}
                  disabled={busy}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 hover:bg-[rgba(224,86,107,0.12)]"
                  style={{
                    border: "1px solid rgba(224,86,107,0.4)",
                    color: "var(--color-danger)",
                  }}
                  aria-label={`Reject ${u.fullName}`}
                  title="Reject"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Accounts panel (admin only) ─────────────────────────────────────────
// Lists every registered account. Non-admin accounts get a role toggle and
// a delete button; admin accounts are read-only (managed manually).
function AccountsPanel() {
  const role = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json() as Promise<{ users: PendingUser[] }>;
    },
    enabled: role === "admin" && open,
  });

  if (role !== "admin") return null;

  const users = data?.users ?? [];

  async function setUserRole(id: string, newRole: "viewer" | "worker" | "manager", name: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_role", role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Role change failed", description: err.error ?? "Please try again." });
        return;
      }
      toast({ title: `Now a ${newRole}`, description: name });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch {
      toast({ title: "Role change failed", description: "Please try again." });
    } finally {
      setActingId(null);
    }
  }

  async function deleteUser(id: string, name: string) {
    if (!window.confirm(`Delete ${name}'s account permanently? This cannot be undone.`)) {
      return;
    }
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Delete failed", description: err.error ?? "Please try again." });
        return;
      }
      toast({ title: "Account deleted", description: name });
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["pending-users"] });
    } catch {
      toast({ title: "Delete failed", description: "Please try again." });
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="glass-card mb-4 p-4" style={{ borderColor: "rgba(25,227,196,0.25)" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Users size={14} style={{ color: "var(--color-teal)" }} />
        <span className="micro-label flex-1">Accounts</span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--color-text-low)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-low)" }} />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {users.map((u) => {
              const busy = actingId === u.id;
              const isAdminUser = u.role === "admin";
              const statusColor =
                u.approvalStatus === "approved"
                  ? "var(--color-teal)"
                  : u.approvalStatus === "rejected"
                  ? "var(--color-danger)"
                  : "var(--color-gold)";
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-2 rounded-xl p-2"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
                    style={{
                      border: `1px solid ${statusColor}`,
                      color: statusColor,
                      background: "rgba(255,255,255,0.04)",
                    }}
                  >
                    {u.fullName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                      {u.fullName}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--color-text-low)" }}>
                      {u.email}
                      {u.approvalStatus !== "approved" && (
                        <span style={{ color: statusColor }}> · {u.approvalStatus}</span>
                      )}
                    </p>
                  </div>
                  {isAdminUser ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        border: "1px solid rgba(201,160,99,0.4)",
                        color: "var(--color-gold)",
                      }}
                    >
                      Admin
                    </span>
                  ) : (
                    <div
                      className="flex items-center gap-0.5 rounded-full p-0.5"
                      style={{ border: "1px solid var(--color-border)" }}
                    >
                      {(["viewer", "worker", "manager"] as const).map((r) => {
                        const active = u.role === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={busy || active}
                            onClick={() => setUserRole(u.id, r, u.fullName)}
                            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all disabled:cursor-default"
                            style={{
                              background: active ? "var(--color-teal)" : "transparent",
                              color: active ? "#04211d" : "var(--color-text-low)",
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            {busy && !active ? <Loader2 size={10} className="animate-spin" /> : r}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!isAdminUser && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteUser(u.id, u.fullName)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 hover:bg-[rgba(224,86,107,0.12)]"
                      style={{
                        border: "1px solid rgba(224,86,107,0.4)",
                        color: "var(--color-danger)",
                      }}
                      aria-label={`Delete ${u.fullName}`}
                      title="Delete account"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
            {users.length === 0 && (
              <p className="py-2 text-center text-xs" style={{ color: "var(--color-text-low)" }}>
                No accounts yet.
              </p>
            )}
          </div>
        )
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
