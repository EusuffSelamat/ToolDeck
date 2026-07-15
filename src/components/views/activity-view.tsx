"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, Package, X } from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { StatusPill } from "@/components/status-pill";

type Transaction = {
  id: string;
  action: string;
  qtyDelta: number | null;
  note: string | null;
  createdAt: string;
  item: {
    id: string;
    code: string;
    name: string;
    photoUrl: string | null;
    isDeleted: boolean;
  } | null;
  personName: string | null;
  holderName: string | null;
  fromLocationName: string | null;
  toLocationName: string | null;
};

const ACTION_FILTERS = [
  { value: "add", label: "Added" },
  { value: "checkout", label: "Checked out" },
  { value: "checkin", label: "Returned" },
  { value: "move", label: "Moved" },
  { value: "adjust_qty", label: "Qty adjusted" },
  { value: "condition", label: "Condition" },
  { value: "edit", label: "Edited" },
  { value: "delete", label: "Deleted" },
  { value: "restore", label: "Restored" },
];

export function ActivityView() {
  const [, navigate] = useHashRoute();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (activeAction) params.set("action", activeAction);
    params.set("limit", "100");
    return params.toString();
  }, [activeAction]);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?${queryString}`);
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json() as Promise<{ transactions: Transaction[] }>;
    },
  });

  const transactions = data?.transactions ?? [];

  // Group transactions by day for the timeline
  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      const date = new Date(tx.createdAt);
      const key = formatDateKey(date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }
    return groups;
  }, [transactions]);

  return (
    <div className="px-5 pt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Activity</h1>
        <p className="micro-label mt-1">
          {transactions.length} {transactions.length === 1 ? "event" : "events"}
        </p>
      </div>

      {/* Action filter chips */}
      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-2">
        <FilterChip
          label="All"
          active={!activeAction}
          onClick={() => setActiveAction(null)}
        />
        {ACTION_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={activeAction === f.value}
            onClick={() =>
              setActiveAction(activeAction === f.value ? null : f.value)
            }
          />
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass-card h-16 animate-pulse"
              style={{ background: "rgba(10,26,26,0.3)" }}
            />
          ))}
        </div>
      ) : transactions.length === 0 ? (
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
          <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
            {activeAction
              ? `No ${activeAction.replace(/_/g, " ")} events yet.`
              : "Every add, move, and check-out will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          {Object.entries(grouped).map(([dayKey, dayTxs]) => (
            <div key={dayKey}>
              {/* Day header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="micro-label">{dayKey}</span>
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--color-border)" }}
                />
              </div>

              {/* Transactions for this day */}
              <div className="space-y-2">
                {dayTxs.map((tx) => (
                  <TxCard
                    key={tx.id}
                    tx={tx}
                    onItemClick={(itemId) =>
                      navigate({ name: "item-detail", id: itemId })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transaction Card ────────────────────────────────────────────────────
function TxCard({
  tx,
  onItemClick,
}: {
  tx: Transaction;
  onItemClick: (itemId: string) => void;
}) {
  const icon = getActionIcon(tx.action);
  const color = getActionColor(tx.action);

  return (
    <div className="glass-card flex items-start gap-3 p-3">
      {/* Action icon */}
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          border: `1px solid ${color}`,
          color: color,
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
        }}
      >
        {icon}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
          {/* Person */}
          <span style={{ color: "var(--color-text-hi)", fontWeight: 600 }}>
            {tx.personName ?? "Someone"}
          </span>{" "}
          {/* Action + item */}
          {formatActionText(tx)}
          {/* Item link */}
          {tx.item && (
            <button
              onClick={() => onItemClick(tx.item!.id)}
              className="font-medium transition-colors hover:text-[var(--color-teal)]"
              style={{ color: "var(--color-teal)" }}
            >
              {tx.item.code}
            </button>
          )}
        </p>

        {/* Context line: from/to, holder, qty delta */}
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-low)" }}>
          {formatContext(tx)}
        </p>

        {/* Note */}
        {tx.note && (
          <p className="mt-0.5 text-xs italic" style={{ color: "var(--color-text-low)" }}>
            {tx.note}
          </p>
        )}

        {/* Time */}
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-low)" }}>
          {formatTime(tx.createdAt)}
        </p>
      </div>

      {/* Item thumbnail */}
      {tx.item?.photoUrl && (
        <div
          className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <img
            src={tx.item.photoUrl}
            alt={tx.item.name}
            className="h-full w-full object-cover"
            style={{ opacity: tx.item.isDeleted ? 0.4 : 1 }}
          />
        </div>
      )}
    </div>
  );
}

// ── Filter Chip ─────────────────────────────────────────────────────────
function FilterChip({
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
      className="flex flex-shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-xs font-medium transition-all"
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

// ── Helpers ─────────────────────────────────────────────────────────────
function formatDateKey(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);

  if (dDay.getTime() === today.getTime()) return "Today";
  if (dDay.getTime() === yesterday.getTime()) return "Yesterday";

  return d.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatActionText(tx: Transaction): string {
  const itemName = tx.item?.name ?? "an item";
  switch (tx.action) {
    case "add":
      return `added ${itemName} `;
    case "checkout":
      return `checked out ${itemName} `;
    case "checkin":
      return `returned ${itemName} `;
    case "move":
      return `moved ${itemName} `;
    case "adjust_qty":
      return `adjusted quantity of ${itemName} `;
    case "condition":
      return `updated condition of ${itemName} `;
    case "edit":
      return `edited ${itemName} `;
    case "delete":
      return `deleted ${itemName} `;
    case "restore":
      return `restored ${itemName} `;
    case "maintenance":
      return `logged maintenance for ${itemName} `;
    default:
      return `${tx.action} ${itemName} `;
  }
}

function formatContext(tx: Transaction): string {
  const parts: string[] = [];

  if (tx.fromLocationName && tx.toLocationName) {
    parts.push(`${tx.fromLocationName} → ${tx.toLocationName}`);
  } else if (tx.toLocationName) {
    parts.push(`→ ${tx.toLocationName}`);
  }

  if (tx.holderName && tx.action === "checkout") {
    parts.push(`to ${tx.holderName}`);
  }
  if (tx.holderName && tx.action === "checkin") {
    parts.push(`from ${tx.holderName}`);
  }

  if (tx.qtyDelta !== null) {
    parts.push(`${tx.qtyDelta > 0 ? "+" : ""}${tx.qtyDelta}`);
  }

  return parts.join(" · ");
}

function getActionIcon(action: string): React.ReactNode {
  // Use a simple colored dot for all actions — keeps the feed clean
  return <span className="h-2 w-2 rounded-full" style={{ background: "currentColor" }} />;
}

function getActionColor(action: string): string {
  switch (action) {
    case "add":
      return "var(--color-teal)";
    case "checkout":
      return "var(--color-gold)";
    case "checkin":
      return "var(--color-teal)";
    case "move":
      return "var(--color-teal)";
    case "adjust_qty":
      return "var(--color-teal-bright)";
    case "condition":
      return "var(--color-magenta)";
    case "edit":
      return "var(--color-text-low)";
    case "delete":
      return "var(--color-danger)";
    case "restore":
      return "var(--color-teal)";
    case "maintenance":
      return "var(--color-magenta)";
    default:
      return "var(--color-text-low)";
  }
}
