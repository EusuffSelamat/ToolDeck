"use client";

import { LayoutDashboard, Package, ScanLine, MapPin, Activity as ActivityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Route } from "@/hooks/use-hash-route";

const NAV: {
  route: Route;
  label: string;
  icon: typeof LayoutDashboard;
  center?: boolean;
}[] = [
  { route: { name: "dashboard" }, label: "Dashboard", icon: LayoutDashboard },
  { route: { name: "items" }, label: "Items", icon: Package },
  { route: { name: "scan" }, label: "Scan", icon: ScanLine, center: true },
  { route: { name: "locations" }, label: "Locations", icon: MapPin },
  { route: { name: "activity" }, label: "Activity", icon: ActivityIcon },
];

export function BottomNav({
  route,
  onNavigate,
}: {
  route: Route;
  onNavigate: (r: Route) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 glass-strong"
      style={{
        borderTop: "1px solid rgba(126,222,210,0.16)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-between px-2">
        {NAV.map((item) => {
          // Map item-detail/new/edit → "items" so the Items tab stays highlighted
          const activeRouteName =
            route.name === "item-detail" ||
            route.name === "item-new" ||
            route.name === "item-edit"
              ? "items"
              : route.name;
          // Trash + settings don't belong to any nav tab
          const active =
            activeRouteName === "items"
              ? item.route.name === "items"
              : route.name === item.route.name;
          const Icon = item.icon;

          if (item.center) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.route)}
                className="relative flex flex-1 flex-col items-center justify-end pb-2"
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className="glow-ring pulse-live absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
                  style={{
                    background: "var(--color-teal)",
                    color: "#04211d",
                    border: "2px solid var(--color-bg-0)",
                  }}
                >
                  <Icon size={24} strokeWidth={2.2} />
                </span>
                <span
                  className="micro-label mt-1"
                  style={{
                    color: active ? "var(--color-teal)" : "var(--color-text-low)",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.route)}
              className="flex flex-1 flex-col items-center justify-center gap-1 pt-1 transition-colors"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 1.8}
                style={{
                  color: active ? "var(--color-teal)" : "var(--color-text-low)",
                }}
                className="transition-colors"
              />
              <span
                className={cn("micro-label")}
                style={{
                  color: active ? "var(--color-teal)" : "var(--color-text-low)",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
