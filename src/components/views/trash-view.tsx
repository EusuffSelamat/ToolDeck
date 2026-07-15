"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Trash2, Package } from "lucide-react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useToast } from "@/hooks/use-toast";

export function TrashView() {
  const [, navigate] = useHashRoute();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["trash"],
    queryFn: async () => {
      const res = await fetch("/api/items/deleted");
      if (!res.ok) throw new Error("Failed to load deleted items");
      return res.json() as Promise<{
        items: Array<{
          id: string;
          code: string;
          name: string;
          brand: string | null;
          model: string | null;
          photoUrl: string | null;
          categoryName: string | null;
          deletedAt?: string | null;
        }>;
      }>;
    },
  });

  async function handleRestore(id: string, code: string) {
    const res = await fetch(`/api/items/${id}/restore`, { method: "POST" });
    if (!res.ok) {
      toast({ title: "Restore failed", description: "Please try again." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["trash"] });
    qc.invalidateQueries({ queryKey: ["items"] });
    toast({ title: "Restored", description: `${code} is back in inventory.` });
  }

  const items = data?.items ?? [];

  return (
    <div className="px-5 pt-4">
      <button
        onClick={() => navigate({ name: "items" })}
        className="flex items-center gap-1 text-sm transition-colors hover:text-[var(--color-teal)]"
        style={{ color: "var(--color-text-mid)" }}
      >
        <ArrowLeft size={16} /> Items
      </button>

      <div className="mt-3 flex items-center gap-2">
        <Trash2 size={20} style={{ color: "var(--color-text-low)" }} />
        <h1 className="text-2xl font-bold">Recently deleted</h1>
      </div>
      <p className="micro-label mt-1">Restorable for 30 days</p>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="glass-card h-16 animate-pulse"
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
          <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
            Nothing here. Deleted items appear here for 30 days.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => {
            const daysLeft = item.deletedAt
              ? Math.max(0, 30 - Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86400000))
              : 30;
            return (
              <div key={item.id} className="glass-card flex items-center gap-3 p-3">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
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
                      style={{ opacity: 0.5 }}
                    />
                  ) : (
                    <Package size={16} style={{ color: "var(--color-text-low)" }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="micro-label">{item.code}</span>
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--color-text-mid)" }}
                  >
                    {item.name}
                  </p>
                  {(item.brand || item.model) && (
                    <p className="truncate text-xs" style={{ color: "var(--color-text-low)" }}>
                      {[item.brand, item.model].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-[10px]" style={{
                    color: daysLeft <= 3 ? "var(--color-magenta)" : "var(--color-text-low)",
                  }}>
                    {daysLeft <= 3 ? `Expires in ${daysLeft}d` : `${daysLeft}d left`}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(item.id, item.code)}
                  className="btn-ghost-teal flex h-9 items-center gap-1.5 px-3 text-xs"
                >
                  <RotateCcw size={14} /> Restore
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
