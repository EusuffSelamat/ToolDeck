"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { PlexusBackground } from "@/components/plexus-background";
import { AuthScreen } from "@/components/auth-screen";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <>
      <PlexusBackground />
      <div className="relative z-10">
        {status === "loading" ? (
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-teal)" }} />
          </div>
        ) : session ? (
          <AppShell />
        ) : (
          <AuthScreen />
        )}
      </div>
    </>
  );
}
