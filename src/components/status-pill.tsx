import { cn } from "@/lib/utils";

export type ItemStatus = "available" | "checked_out" | "needs_service" | "out_of_order";

const STATUS_COLOR: Record<ItemStatus, string> = {
  available: "var(--color-teal)",
  checked_out: "var(--color-gold)",
  needs_service: "var(--color-magenta)",
  out_of_order: "var(--color-danger)",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  available: "Available",
  checked_out: "Checked out",
  needs_service: "Needs service",
  out_of_order: "Out of order",
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: ItemStatus;
  label?: string;
  className?: string;
}) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className={cn("status-pill", className)}
      style={{ color }}
    >
      <span className="dot" />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
