"use client";

import { useHashRoute, type Route } from "@/hooks/use-hash-route";
import { useRole } from "@/hooks/use-role";
import { canOperate } from "@/lib/roles";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { DashboardView } from "@/components/views/dashboard-view";
import { ItemsView } from "@/components/views/items-view";
import { ItemDetailView } from "@/components/views/item-detail-view";
import { ItemFormView } from "@/components/views/item-form-view";
import { ScanView } from "@/components/views/scan-view";
import { LocationsView } from "@/components/views/locations-view";
import { ActivityView } from "@/components/views/activity-view";
import { TrashView } from "@/components/views/trash-view";
import { SettingsView } from "@/components/views/settings-view";

function renderView(route: Route, viewOnly: boolean) {
  switch (route.name) {
    case "dashboard":
      return <DashboardView />;
    case "items":
      return <ItemsView />;
    case "item-new":
      // Viewers cannot add items — fall back to the items list.
      return viewOnly ? <ItemsView /> : <ItemFormView />;
    case "item-detail":
      return <ItemDetailView id={route.id} />;
    case "item-edit":
      return viewOnly ? <ItemsView /> : <ItemFormView id={route.id} />;
    case "scan":
      // Scan is hidden from viewers; deep-linking #scan lands on the dashboard.
      return viewOnly ? <DashboardView /> : <ScanView />;
    case "locations":
      return <LocationsView />;
    case "activity":
      return <ActivityView />;
    case "trash":
      return <TrashView />;
    case "settings":
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

export function AppShell() {
  const [route, navigate] = useHashRoute();
  const role = useRole();
  const viewOnly = !canOperate(role);

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1 pb-24" style={{ maxWidth: "100%" }}>
        <div className="mx-auto w-full max-w-md">{renderView(route, viewOnly)}</div>
      </main>
      <BottomNav route={route} onNavigate={navigate} />
    </div>
  );
}
