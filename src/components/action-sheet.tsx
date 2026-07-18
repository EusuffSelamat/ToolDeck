"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  LogOut,
  LogIn,
  Move,
  Plus,
  Minus,
  Wrench,
  Pencil,
  Loader2,
  Check,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { canManage, type Role } from "@/lib/roles";

type Action = "edit" | "checkout" | "checkin" | "move" | "adjust_qty" | "condition";

type Meta = {
  locations: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  currentUser: { id: string; name: string };
  role: Role;
};

type ItemData = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  categoryId: string | null;
  trackingType: string;
  status: string;
  condition: string;
  quantity: number;
  homeLocationId: string | null;
  currentLocationId: string | null;
  currentLocationName: string | null;
  holderId: string | null;
  holderName: string | null;
  notes: string | null;
};

export function ActionSheet({
  item,
  meta,
  onClose,
}: {
  item: ItemData;
  meta: Meta;
  onClose: () => void;
}) {
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  const isCheckedOut = item.status === "checked_out";
  const isAsset = item.trackingType === "asset";
  const isStock = item.trackingType === "stock";

  // Define available actions based on item state.
  // Managers and admins see all 6 actions; workers only checkout/return/move.
  const isAdmin = canManage(meta.role);

  const actions: Array<{
    id: Action;
    label: string;
    icon: typeof LogOut;
    color: string;
    disabled?: boolean;
    disabledReason?: string;
  }> = [
    ...(isAdmin ? [{
      id: "edit" as const,
      label: "Edit details",
      icon: Pencil,
      color: "var(--color-teal)",
    }] : []),
    {
      id: "checkout",
      label: "Check out",
      icon: LogOut,
      color: "var(--color-gold)",
      disabled: !isAsset || isCheckedOut,
      disabledReason: !isAsset
        ? "Only unique assets can be checked out"
        : isCheckedOut
        ? "Already checked out"
        : undefined,
    },
    {
      id: "checkin",
      label: "Return",
      icon: LogIn,
      color: "var(--color-teal)",
      disabled: !isCheckedOut,
      disabledReason: !isCheckedOut ? "Not checked out" : undefined,
    },
    {
      id: "move",
      label: "Move",
      icon: Move,
      color: "var(--color-teal)",
    },
    ...(isAdmin ? [{
      id: "adjust_qty" as const,
      label: "Adjust quantity",
      icon: Plus,
      color: "var(--color-teal)",
      disabled: !isStock,
      disabledReason: !isStock ? "Only for stock items" : undefined,
    }] : []),
    ...(isAdmin ? [{
      id: "condition" as const,
      label: "Update condition",
      icon: Wrench,
      color: "var(--color-magenta)",
    }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(3,10,10,0.8)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--color-border)", maxHeight: "85vh", overflowY: "auto" }}
      >
        {selectedAction ? (
          <ActionForm
            action={selectedAction}
            item={item}
            meta={meta}
            onBack={() => setSelectedAction(null)}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--color-border)" }}>
              <div>
                <h2 className="text-lg font-bold">Actions</h2>
                <p className="micro-label mt-0.5">{item.code} · {item.name}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
                style={{ color: "var(--color-text-mid)" }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action list */}
            <div className="p-3">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => !a.disabled && setSelectedAction(a.id)}
                    disabled={a.disabled}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[rgba(25,227,196,0.04)] disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        border: `1px solid ${a.color}`,
                        color: a.color,
                        background: `color-mix(in srgb, ${a.color} 10%, transparent)`,
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                        {a.label}
                      </p>
                      {a.disabledReason && (
                        <p className="text-[10px]" style={{ color: "var(--color-text-low)" }}>
                          {a.disabledReason}
                        </p>
                      )}
                    </div>
                    {!a.disabled && (
                      <ChevronRight size={16} style={{ color: "var(--color-text-low)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Action Form ──────────────────────────────────────────────────────────
function ActionForm({
  action,
  item,
  meta,
  onBack,
  onClose,
}: {
  action: Action;
  item: ItemData;
  meta: Meta;
  onBack: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  // Form state
  const [holderId, setHolderId] = useState(meta.currentUser.id);
  const [toLocationId, setToLocationId] = useState(item.currentLocationId ?? "");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [note, setNote] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<"used" | "restocked" | "counted" | "damaged">("used");
  const [condition, setCondition] = useState<"good" | "needs_service" | "out_of_order">("good");

  // Edit details state
  const [editName, setEditName] = useState(item.name);
  const [editBrand, setEditBrand] = useState(item.brand ?? "");
  const [editModel, setEditModel] = useState(item.model ?? "");
  const [editSerial, setEditSerial] = useState(item.serialNo ?? "");
  const [editCategoryId, setEditCategoryId] = useState(item.categoryId ?? "");
  const [editHomeLocationId, setEditHomeLocationId] = useState(item.homeLocationId ?? "");
  const [editNotes, setEditNotes] = useState(item.notes ?? "");

  const labels: Record<Action, string> = {
    edit: "Edit details",
    checkout: "Check out",
    checkin: "Return item",
    move: "Move to location",
    adjust_qty: "Adjust quantity",
    condition: "Update condition",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      let res: Response;

      if (action === "edit") {
        // Edit details uses PATCH /api/items/[id]
        const payload: Record<string, unknown> = {
          name: editName.trim(),
          brand: editBrand.trim() || null,
          model: editModel.trim() || null,
          serialNo: editSerial.trim() || null,
          categoryId: editCategoryId || null,
          homeLocationId: editHomeLocationId || null,
          notes: editNotes.trim() || null,
        };
        res = await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Custody actions use POST /api/items/[id]/action
        const payload: Record<string, unknown> = { action, note: note.trim() || null };

        if (action === "checkout") {
          payload.holderId = holderId || null;
          payload.toLocationId = toLocationId || null;
          payload.expectedReturnDate = expectedReturnDate || null;
        } else if (action === "move") {
          payload.toLocationId = toLocationId;
        } else if (action === "adjust_qty") {
          payload.delta = parseFloat(delta);
          payload.reason = reason;
        } else if (action === "condition") {
          payload.condition = condition;
        }

        res = await fetch(`/api/items/${item.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Action failed",
          description: err.error ?? "Please try again.",
        });
        setBusy(false);
        return;
      }

      // Invalidate queries to refresh detail + lists + stats
      qc.invalidateQueries({ queryKey: ["item", item.id] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["stats"] });

      toast({
        title: labels[action],
        description: `${item.code} updated.`,
      });

      onClose();
    } catch {
      toast({ title: "Action failed", description: "Please try again." });
      setBusy(false);
    }
  }

  return (
    <>
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b p-5" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgba(25,227,196,0.08)]"
          style={{ color: "var(--color-text-mid)" }}
          aria-label="Back"
        >
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h2 className="text-lg font-bold">{labels[action]}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {/* Edit details form */}
        {action === "edit" && (
          <>
            <FormField label="Name">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                style={{ color: "var(--color-text-hi)" }}
                required
                autoFocus
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Brand">
                <input
                  type="text"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                  style={{ color: "var(--color-text-hi)" }}
                />
              </FormField>
              <FormField label="Model">
                <input
                  type="text"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                  style={{ color: "var(--color-text-hi)" }}
                />
              </FormField>
            </div>

            <FormField label="Serial number">
              <input
                type="text"
                value={editSerial}
                onChange={(e) => setEditSerial(e.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                style={{ color: "var(--color-text-hi)" }}
              />
            </FormField>

            <FormField label="Category">
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              >
                <option value="" style={{ background: "var(--color-bg-1)" }}>
                  Uncategorised
                </option>
                {meta.categories.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: "var(--color-bg-1)" }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Home location">
              <select
                value={editHomeLocationId}
                onChange={(e) => setEditHomeLocationId(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              >
                <option value="" style={{ background: "var(--color-bg-1)" }}>
                  None
                </option>
                {meta.locations.map((l) => (
                  <option key={l.id} value={l.id} style={{ background: "var(--color-bg-1)" }}>
                    {l.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notes">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={3}
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                style={{ color: "var(--color-text-hi)" }}
              />
            </FormField>

            <p className="text-xs" style={{ color: "var(--color-text-low)" }}>
              Tracking type, condition, current location, and holder are managed via the other actions.
            </p>
          </>
        )}

        {/* Checkout form */}
        {action === "checkout" && (
          <>
            <FormField label="Checked out to">
              <select
                value={holderId}
                onChange={(e) => setHolderId(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              >
                <option value={meta.currentUser.id} style={{ background: "var(--color-bg-1)" }}>
                  Me ({meta.currentUser.name})
                </option>
              </select>
            </FormField>

            <FormField label="Current location">
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-hi)" }}
              >
                <option value="" style={{ background: "var(--color-bg-1)" }}>
                  Keep current ({item.currentLocationName ?? "none"})
                </option>
                {meta.locations.map((l) => (
                  <option key={l.id} value={l.id} style={{ background: "var(--color-bg-1)" }}>
                    {l.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Expected return date (optional)">
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: "var(--color-text-low)" }} />
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: "var(--color-text-hi)" }}
                />
              </div>
            </FormField>
          </>
        )}

        {/* Checkin form */}
        {action === "checkin" && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              background: "rgba(14,79,74,0.2)",
              border: "1px solid rgba(25,227,196,0.2)",
              color: "var(--color-text-mid)",
            }}
          >
            Returning <span style={{ color: "var(--color-text-hi)" }}>{item.code}</span>
            {item.holderName && (
              <> from <span style={{ color: "var(--color-text-hi)" }}>{item.holderName}</span></>
            )}.
            Status will reset to <span style={{ color: "var(--color-teal)" }}>Available</span> and
            location will return to the item&apos;s home.
          </div>
        )}

        {/* Move form */}
        {action === "move" && (
          <FormField label="Move to">
            <select
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: "var(--color-text-hi)" }}
              required
            >
              <option value="" style={{ background: "var(--color-bg-1)" }}>
                Select destination…
              </option>
              {meta.locations.map((l) => (
                <option key={l.id} value={l.id} style={{ background: "var(--color-bg-1)" }}>
                  {l.name}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Adjust quantity form */}
        {action === "adjust_qty" && (
          <>
            <FormField label={`Quantity change (current: ${item.quantity})`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const v = parseFloat(delta) || 0;
                    setDelta(String(v - 1));
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-danger)" }}
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  step="any"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-center text-lg font-semibold outline-none"
                  style={{ color: "var(--color-text-hi)" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = parseFloat(delta) || 0;
                    setDelta(String(v + 1));
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-teal)" }}
                >
                  <Plus size={16} />
                </button>
              </div>
              {delta && parseFloat(delta) !== 0 && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--color-text-mid)" }}>
                  New quantity:{" "}
                  <span style={{ color: "var(--color-text-hi)" }}>
                    {Math.max(0, item.quantity + parseFloat(delta))}
                  </span>
                </p>
              )}
            </FormField>

            <FormField label="Reason">
              <div className="flex gap-1 rounded-full p-1" style={{ border: "1px solid var(--color-border)" }}>
                {(["used", "restocked", "counted", "damaged"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="flex-1 rounded-full py-2 text-xs font-medium capitalize transition-all"
                    style={{
                      background: reason === r ? "var(--color-teal)" : "transparent",
                      color: reason === r ? "#04211d" : "var(--color-text-mid)",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </FormField>
          </>
        )}

        {/* Condition form */}
        {action === "condition" && (
          <FormField label="New condition">
            <div className="space-y-2">
              {([
                { value: "good", label: "Good", color: "var(--color-teal)" },
                { value: "needs_service", label: "Needs service", color: "var(--color-magenta)" },
                { value: "out_of_order", label: "Out of order", color: "var(--color-danger)" },
              ] as const).map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCondition(c.value)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all ${
                    condition === c.value ? "glass-selected" : ""
                  }`}
                  style={
                    condition === c.value
                      ? undefined
                      : { border: "1px solid var(--color-border)" }
                  }
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
                    {c.label}
                  </span>
                  {item.condition === c.value && (
                    <span className="ml-auto text-[10px]" style={{ color: "var(--color-text-low)" }}>
                      current
                    </span>
                  )}
                </button>
              ))}
            </div>
          </FormField>
        )}

        {/* Note (all actions) */}
        <FormField label="Note (optional)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for the audit trail…"
            rows={2}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
            style={{ color: "var(--color-text-hi)" }}
          />
        </FormField>

        {/* Actions */}
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
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {labels[action]}
          </button>
        </div>
      </form>
    </>
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
