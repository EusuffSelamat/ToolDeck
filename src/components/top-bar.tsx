"use client";

import { Search, LogOut, User as UserIcon } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { BrandMark } from "@/components/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? "User";
  const email = session?.user?.email ?? "";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 glass-strong"
      style={{ borderRadius: 0 }}
    >
      <BrandMark size="sm" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[rgba(25,227,196,0.08)]"
          style={{ color: "var(--color-text-mid)" }}
        >
          <Search size={18} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors hover:bg-[rgba(25,227,196,0.08)]"
              style={{
                border: "1px solid rgba(25,227,196,0.5)",
                color: "var(--color-teal)",
              }}
            >
              {initials || <UserIcon size={15} />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            style={{
              background: "rgba(6,17,17,0.96)",
              backdropFilter: "blur(18px)",
              border: "1px solid var(--color-border)",
            }}
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span style={{ color: "var(--color-text-hi)" }}>{name}</span>
              <span className="text-xs font-normal" style={{ color: "var(--color-text-low)" }}>
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator style={{ background: "var(--color-border)" }} />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="cursor-pointer"
              style={{ color: "var(--color-danger)" }}
            >
              <LogOut size={15} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
