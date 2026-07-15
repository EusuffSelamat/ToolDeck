"use client";

import { useHashRoute, type Route } from "@/hooks/use-hash-route";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { DashboardView } from "@/components/views/dashboard-view";
import { ItemsView } from "@/components/views/items-view";
import { ScanView } from "@/components/views/scan-view";
import { LocationsView } from "@/components/views/locations-view";
import { ActivityView } from "@/components/views/activity-view";

function renderView(route: Route) {
  switch (route.name) {
    case "dashboard":
      return <DashboardView />;
    case "items":
      return <ItemsView />;
    case "scan":
      return <ScanView />;
    case "locations":
      return <LocationsView />;
    case "activity":
      return <ActivityView />;
    default:
      return <DashboardView />;
  }
}

export function AppShell() {
  const [route, navigate] = useHashRoute();

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <TopBar />
      <main
        className="flex-1 pb-24"
        style={{ maxWidth: "100%" }}
      >
        <div className="mx-auto w-full max-w-md">{renderView(route)}</div>
      </main>
      <BottomNav route={route} onNavigate={navigate} />
    </div>
  );
}
