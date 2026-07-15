"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Package,
  MapPin,
  User as UserIcon,
  Hash,
  Tag,
  Boxes,
  Wrench,
  StickyNote,
  Clock,
} from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { StatusPill, type ItemStatus } from "@/components/status-pill";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function ItemDetailView({ id }: { id: string }) {
  const [, navigate] = useHashRoute();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const res = await fetch(`/api/items/${id}`);
      if (!res.ok) throw new Error("Failed to load item");
      return res.json() as Promise<{
        item: {
          id: string;
          code: string;
          name: string;
          brand: string | null;
          model: string | null;
          serialNo: string | null;
          categoryName: string | null;
          trackingType: string;
          status: ItemStatus;
          condition: string;
          quantity: number;
          minQuantity: number;
          homeLocationName: string | null;
          currentLocationName: string | null;
          holderName: string | null;
          photoUrl: string | null;
          aiConfidence: number | null;
          notes: string | null;
          isDeleted: boolean;
          deletedAt: string | null;
          createdAt: string;
          updatedAt: string;
          transactions: Array<{
            id: string;
            action: string;
            qtyDelta: number | null;
            note: string | null;
            createdAt: string;
            personName: string | null;
            holderName: string | null;
            fromLocationName: string | null;
            toLocationName: string | null;
          }>;
        };
      }>;
    },
  });

  async function handleDelete() {
    if (!data) return;
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Delete failed", description: "Please try again." });
      return;
    }
    // Invalidate lists
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["trash"] });

    // Undo toast
    toast({
      title: "Item deleted",
      description: `${data.item.code} moved to Recently Deleted.`,
      action: (
        <ToastAction
          altText="Undo"
          onClick={async () => {
            const restoreRes = await fetch(`/api/items/${id}/restore`, {
              method: "POST",
            });
            if (restoreRes.ok) {
              qc.invalidateQueries({ queryKey: ["items"] });
              qc.invalidateQueries({ queryKey: ["trash"] });
              toast({ title: "Restored", description: `${data.item.code} is back.` });
            } else {
              toast({
                title: "Undo failed",
                description: "Find it in Recently Deleted to retry.",
              });
            }
          }}
        >
          Undo
        </ToastAction>
      ),
    });

    navigate({ name: "items" });
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-4">
        <div className="glass-card h-64 animate-pulse" style={{ background: "rgba(10,26,26,0.3)" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-5 pt-4">
        <BackButton onClick={() => navigate({ name: "items" })} />
        <p style={{ color: "var(--color-text-mid)" }}>Item not found.</p>
      </div>
    );
  }

  const item = data.item;

  return (
    <div className="px-5 pt-4">
      <BackButton onClick={() => navigate({ name: "items" })} />

      {/* Photo hero */}
      <div
        className="relative mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-card)]"
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
          <Package size={40} style={{ color: "var(--color-text-low)" }} />
        )}
        {/* Status pill overlay */}
        <div className="absolute left-3 top-3">
          <StatusPill status={item.status} />
        </div>
        {item.aiConfidence != null && item.aiConfidence > 0 && (
          <div
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{
              background: "rgba(3,10,10,0.8)",
              color: "var(--color-teal)",
              border: "1px solid var(--color-border)",
            }}
          >
            AI {Math.round(item.aiConfidence * 100)}%
          </div>
        )}
      </div>

      {/* Title + actions */}
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="micro-label">{item.code}</span>
          <h1 className="mt-1 text-xl font-bold leading-tight">{item.name}</h1>
          {item.brand && (
            <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
              {item.brand}
              {item.model ? ` ${item.model}` : ""}
            </p>
          )}
        </div>
        {/* Hide edit/delete when soft-deleted */}
        {!item.isDeleted && (
          <div className="flex gap-2">
            <button
              onClick={() => navigate({ name: "item-edit", id: item.id })}
              className="btn-ghost-teal flex h-9 w-9 items-center justify-center"
              aria-label="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={handleDelete}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[rgba(224,86,107,0.1)]"
              style={{
                border: "1px solid rgba(224,86,107,0.3)",
                color: "var(--color-danger)",
              }}
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Deleted banner */}
      {item.isDeleted && (
        <div
          className="glass-card mt-3 flex items-center gap-3 p-3"
          style={{ borderColor: "rgba(224,86,107,0.3)" }}
        >
          <Trash2 size={16} style={{ color: "var(--color-danger)" }} />
          <p className="flex-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
            This item is deleted. Restore it from Recently Deleted.
          </p>
          <button
            onClick={async () => {
              const res = await fetch(`/api/items/${id}/restore`, { method: "POST" });
              if (res.ok) {
                qc.invalidateQueries({ queryKey: ["item", id] });
                qc.invalidateQueries({ queryKey: ["items"] });
                qc.invalidateQueries({ queryKey: ["trash"] });
                toast({ title: "Restored", description: `${item.code} is back.` });
              }
            }}
            className="btn-ghost-teal flex h-8 items-center px-3 text-xs"
          >
            Restore
          </button>
        </div>
      )}

      {/* Spec grid */}
      <div className="glass-card mt-4 divide-y" style={{ borderColor: "var(--color-border)" }}>
        <SpecRow icon={Hash} label="Code" value={item.code} />
        {item.brand && <SpecRow icon={Tag} label="Brand" value={item.brand} />}
        {item.model && <SpecRow icon={Tag} label="Model" value={item.model} />}
        {item.serialNo && (
          <SpecRow icon={Hash} label="Serial" value={item.serialNo} />
        )}
        <SpecRow
          icon={Tag}
          label="Category"
          value={item.categoryName ?? "Uncategorised"}
        />
        <SpecRow
          icon={Boxes}
          label="Type"
          value={item.trackingType === "asset" ? "Unique asset" : "Stock"}
        />
        {item.trackingType === "stock" && (
          <>
            <SpecRow icon={Boxes} label="Quantity" value={String(item.quantity)} />
            <SpecRow
              icon={Boxes}
              label="Min quantity"
              value={String(item.minQuantity)}
            />
          </>
        )}
        <SpecRow icon={Wrench} label="Condition" value={item.condition.replace(/_/g, " ")} />
        <SpecRow
          icon={MapPin}
          label="Home location"
          value={item.homeLocationName ?? "—"}
        />
        <SpecRow
          icon={MapPin}
          label="Current location"
          value={item.currentLocationName ?? "—"}
        />
        <SpecRow
          icon={UserIcon}
          label="Holder"
          value={item.holderName ?? "—"}
        />
      </div>

      {/* Notes */}
      {item.notes && (
        <div className="glass-card mt-4 p-4">
          <div className="mb-2 flex items-center gap-2">
            <StickyNote size={14} style={{ color: "var(--color-text-low)" }} />
            <span className="micro-label">Notes</span>
          </div>
          <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
            {item.notes}
          </p>
        </div>
      )}

      {/* History timeline */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Clock size={14} style={{ color: "var(--color-text-low)" }} />
          <span className="micro-label">History</span>
        </div>
        {item.transactions.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-low)" }}>
            No activity yet.
          </p>
        ) : (
          <div className="space-y-2">
            {item.transactions.map((tx, i) => (
              <div
                key={tx.id}
                className="glass-card flex items-start gap-3 p-3"
              >
                <span className="num-chip" style={{ marginTop: 1 }}>
                  {item.transactions.length - i}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                    {formatAction(tx.action)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                    {tx.personName ?? "Unknown"}
                    {tx.holderName && tx.holderName !== tx.personName
                      ? ` → ${tx.holderName}`
                      : ""}
                    {tx.fromLocationName && tx.toLocationName
                      ? ` · ${tx.fromLocationName} → ${tx.toLocationName}`
                      : ""}
                    {tx.qtyDelta !== null
                      ? ` · ${tx.qtyDelta > 0 ? "+" : ""}${tx.qtyDelta}`
                      : ""}
                  </p>
                  {tx.note && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-low)" }}>
                      {tx.note}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-low)" }}>
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-sm transition-colors hover:text-[var(--color-teal)]"
      style={{ color: "var(--color-text-mid)" }}
    >
      <ArrowLeft size={16} /> Items
    </button>
  );
}

function SpecRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={14} style={{ color: "var(--color-text-low)" }} />
        <span className="micro-label">{label}</span>
      </div>
      <span
        className="text-right text-sm"
        style={{ color: "var(--color-text-hi)" }}
      >
        {value}
      </span>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    add: "Added to inventory",
    checkout: "Checked out",
    checkin: "Returned",
    move: "Moved",
    adjust_qty: "Quantity adjusted",
    condition: "Condition updated",
    edit: "Details edited",
    delete: "Deleted",
    restore: "Restored",
    maintenance: "Maintenance logged",
  };
  return map[action] ?? action;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
