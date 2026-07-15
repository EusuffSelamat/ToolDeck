"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, X, Loader2, Calendar, DollarSign, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type MaintenanceLog = {
  id: string;
  doneAt: string;
  description: string;
  cost: number | null;
  nextDue: string | null;
  createdByName: string | null;
  createdAt: string;
};

export function MaintenanceSection({ itemId }: { itemId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance", itemId],
    queryFn: async () => {
      const res = await fetch(`/api/items/${itemId}/maintenance`);
      if (!res.ok) throw new Error("Failed to load maintenance");
      return res.json() as Promise<{ logs: MaintenanceLog[] }>;
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench size={14} style={{ color: "var(--color-text-low)" }} />
          <span className="micro-label">Maintenance</span>
          {logs.length > 0 && (
            <span className="micro-label" style={{ color: "var(--color-teal)" }}>
              · {logs.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-ghost-teal flex h-7 items-center gap-1 px-2.5 text-xs"
        >
          <Plus size={12} /> Log
        </button>
      </div>

      {isLoading ? (
        <div className="glass-card h-16 animate-pulse" style={{ background: "rgba(10,26,26,0.3)" }} />
      ) : logs.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-low)" }}>
          No maintenance logged yet.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const now = new Date();
            const dueDate = log.nextDue ? new Date(log.nextDue) : null;
            const isOverdue = dueDate ? dueDate < now : false;
            const isUpcoming = !isOverdue && dueDate ? dueDate <= new Date(Date.now() + 14 * 86400000) : false;
            return (
              <div key={log.id} className="glass-card p-3">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                    style={{
                      background: isOverdue ? "var(--color-danger)" : isUpcoming ? "var(--color-magenta)" : "var(--color-teal)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: "var(--color-text-hi)" }}>
                      {log.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-low)" }}>
                        <Calendar size={10} />
                        {new Date(log.doneAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {log.cost !== null && log.cost > 0 && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-low)" }}>
                          <DollarSign size={10} />
                          {log.cost.toFixed(2)}
                        </span>
                      )}
                      {log.nextDue && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-semibold"
                          style={{
                            color: isOverdue
                              ? "var(--color-danger)"
                              : isUpcoming
                              ? "var(--color-magenta)"
                              : "var(--color-text-low)",
                          }}
                        >
                          <Clock size={10} />
                          {isOverdue ? "Overdue: " : isUpcoming ? "Due soon: " : "Next: "}
                          {new Date(log.nextDue).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {log.createdByName && (
                        <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>
                          · {log.createdByName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <MaintenanceForm
          itemId={itemId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["maintenance", itemId] });
            qc.invalidateQueries({ queryKey: ["item", itemId] });
          }}
        />
      )}
    </div>
  );
}

function MaintenanceForm({
  itemId,
  onClose,
  onSaved,
}: {
  itemId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [doneAt, setDoneAt] = useState(new Date().toISOString().split("T")[0]);
  const [cost, setCost] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setBusy(true);

    const payload: Record<string, unknown> = {
      description: description.trim(),
      doneAt: doneAt ? new Date(doneAt).toISOString() : undefined,
    };
    if (cost) payload.cost = parseFloat(cost);
    if (nextDue) payload.nextDue = new Date(nextDue).toISOString();

    try {
      const res = await fetch(`/api/items/${itemId}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Failed", description: err.error ?? "Please try again." });
        setBusy(false);
        return;
      }
      toast({ title: "Maintenance logged", description: description.trim().slice(0, 60) });
      onSaved();
    } catch {
      toast({ title: "Failed", description: "Please try again." });
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
        style={{ border: "1px solid var(--color-border)", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Log maintenance</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
            style={{ color: "var(--color-text-mid)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was done? e.g. Replaced worn brushes, cleaned motor"
              rows={3}
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
              style={{ color: "var(--color-text-hi)" }}
              required
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date done">
              <input
                type="date"
                value={doneAt}
                onChange={(e) => setDoneAt(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              />
            </FormField>
            <FormField label="Cost (optional)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                style={{ color: "var(--color-text-hi)" }}
              />
            </FormField>
          </div>

          <FormField label="Next due (optional)">
            <input
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--color-text-hi)" }}
            />
            {nextDue && new Date(nextDue) <= new Date(Date.now() + 14 * 86400000) && (
              <p className="mt-1.5 text-xs" style={{ color: "var(--color-magenta)" }}>
                This will flag the item as needing service.
              </p>
            )}
          </FormField>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost-teal flex-1 h-11 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-teal flex-[2] h-11 flex items-center justify-center gap-2 text-sm"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Log maintenance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="micro-label">{label}</span>
      <div
        className="rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
        style={{
          border: "1px solid var(--color-border)",
          background: "rgba(6,17,17,0.6)",
        }}
      >
        {children}
      </div>
    </label>
  );
}
