"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  Download,
  FileText,
  Sheet,
  RotateCcw,
  User as UserIcon,
  Tag,
  LogOut,
  Loader2,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToXLSX } from "@/lib/export";

type Category = { id: string; name: string; sort: number };

export function SettingsView() {
  const { data: session } = useSession();
  const [, navigate] = useHashRoute();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["meta"],
    queryFn: async () => {
      const res = await fetch("/api/meta");
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<{
        categories: Category[];
        locations: Array<{ id: string; name: string; kind: string }>;
      }>;
    },
  });

  async function handleExportAll(format: "csv" | "xlsx") {
    // Fetch all non-deleted items for export
    const res = await fetch("/api/items?limit=100");
    if (!res.ok) {
      toast({ title: "Export failed", description: "Could not load items." });
      return;
    }
    const data = await res.json();
    if (format === "csv") {
      exportToCSV(data.items, "tooldeck-all-items");
    } else {
      exportToXLSX(data.items, "tooldeck-all-items");
    }
    toast({ title: "Exported", description: `${data.items.length} items as ${format.toUpperCase()}` });
  }

  async function handleDeleteCategory(id: string, name: string) {
    // Check if any items use this category
    const res = await fetch(`/api/items?categoryId=${id}&limit=1`);
    const data = await res.json();
    if (data.items?.length > 0) {
      toast({
        title: "Cannot delete",
        description: `${data.total} item(s) use this category. Reassign them first.`,
      });
      return;
    }

    const delRes = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      toast({ title: "Delete failed", description: err.error ?? "Please try again." });
      return;
    }
    qc.invalidateQueries({ queryKey: ["meta"] });
    toast({ title: "Category deleted", description: name });
  }

  const categories = meta?.categories ?? [];

  return (
    <div className="px-5 pt-4">
      <div className="mb-5 flex items-center gap-2">
        <SettingsIcon size={20} style={{ color: "var(--color-text-low)" }} />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Profile section */}
      <div className="glass-card mb-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserIcon size={14} style={{ color: "var(--color-text-low)" }} />
          <span className="micro-label">Profile</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full font-display font-bold"
            style={{
              border: "1px solid rgba(25,227,196,0.5)",
              color: "var(--color-teal)",
              background: "rgba(14,79,74,0.2)",
            }}
          >
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>
              {session?.user?.name ?? "User"}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--color-text-low)" }}>
              {session?.user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors hover:bg-[rgba(224,86,107,0.1)]"
          style={{
            border: "1px solid rgba(224,86,107,0.3)",
            color: "var(--color-danger)",
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>

      {/* Categories editor */}
      <div className="glass-card mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={14} style={{ color: "var(--color-text-low)" }} />
            <span className="micro-label">Categories</span>
            <span className="micro-label" style={{ color: "var(--color-teal)" }}>
              · {categories.length}
            </span>
          </div>
          <button
            onClick={() => {
              setEditingCat(null);
              setShowCatForm(true);
            }}
            className="btn-ghost-teal flex h-7 items-center gap-1 px-2.5 text-xs"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[rgba(25,227,196,0.04)]"
            >
              <GripVertical size={14} style={{ color: "var(--color-text-low)" }} />
              <span className="flex-1 text-sm" style={{ color: "var(--color-text-hi)" }}>
                {cat.name}
              </span>
              <button
                onClick={() => {
                  setEditingCat(cat);
                  setShowCatForm(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[rgba(25,227,196,0.08)]"
                style={{ color: "var(--color-text-mid)" }}
                aria-label="Edit"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[rgba(224,86,107,0.08)]"
                style={{ color: "var(--color-danger)" }}
                aria-label="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Export section */}
      <div className="glass-card mb-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Download size={14} style={{ color: "var(--color-text-low)" }} />
          <span className="micro-label">Export all items</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleExportAll("csv")}
            className="btn-ghost-teal flex-1 h-10 flex items-center justify-center gap-2 text-sm"
          >
            <FileText size={15} /> CSV
          </button>
          <button
            onClick={() => handleExportAll("xlsx")}
            className="btn-ghost-teal flex-1 h-10 flex items-center justify-center gap-2 text-sm"
          >
            <Sheet size={15} /> Excel
          </button>
        </div>
        <p className="mt-2 text-[10px]" style={{ color: "var(--color-text-low)" }}>
          Exports all active (non-deleted) items. Use the export button on the Items tab to export a filtered set.
        </p>
      </div>

      {/* Recently deleted */}
      <div className="glass-card mb-4 p-4">
        <div className="mb-3 flex items-center gap-2">
          <RotateCcw size={14} style={{ color: "var(--color-text-low)" }} />
          <span className="micro-label">Recently deleted</span>
        </div>
        <button
          onClick={() => navigate({ name: "trash" })}
          className="flex w-full items-center justify-between rounded-xl p-2 text-left transition-colors hover:bg-[rgba(25,227,196,0.04)]"
        >
          <span className="text-sm" style={{ color: "var(--color-text-mid)" }}>
            View restorable items (30-day window)
          </span>
          <X size={14} className="rotate-45" style={{ color: "var(--color-text-low)" }} />
        </button>
      </div>

      <p className="mt-6 text-center text-xs" style={{ color: "var(--color-text-low)" }}>
        TOOLDECK · v1.0
      </p>

      {showCatForm && (
        <CategoryForm
          category={editingCat}
          onClose={() => {
            setShowCatForm(false);
            setEditingCat(null);
          }}
          onSaved={() => {
            setShowCatForm(false);
            setEditingCat(null);
            qc.invalidateQueries({ queryKey: ["meta"] });
          }}
        />
      )}
    </div>
  );
}

// ── Category Add/Edit Form ──────────────────────────────────────────────
function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [busy, setBusy] = useState(false);
  const isEdit = !!category;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);

    const url = isEdit ? `/api/categories/${category!.id}` : "/api/categories";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        title: isEdit ? "Update failed" : "Could not add category",
        description: err.error ?? "Please try again.",
      });
      setBusy(false);
      return;
    }

    toast({
      title: isEdit ? "Category updated" : "Category added",
      description: name.trim(),
    });
    onSaved();
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
        style={{ border: "1px solid var(--color-border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isEdit ? "Edit category" : "Add category"}
          </h2>
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
          <label className="flex flex-col gap-1.5">
            <span className="micro-label">Name</span>
            <div
              className="rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
              style={{ border: "1px solid var(--color-border)", background: "rgba(6,17,17,0.6)" }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Power Tools"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
                style={{ color: "var(--color-text-hi)" }}
                autoFocus
                required
              />
            </div>
          </label>

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
              {isEdit ? "Save" : "Add category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
