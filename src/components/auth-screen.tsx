"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, Mail, Lock, User as UserIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useToast } from "@/hooks/use-toast";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Could not create your account.");
          setBusy(false);
          return;
        }
        toast({
          title: "Account created",
          description: "Welcome to TOOLDECK.",
        });
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(
          mode === "signup"
            ? "Account created, but sign-in failed. Try logging in."
            : "Wrong email or password."
        );
        setBusy(false);
        return;
      }

      // Sign-in succeeded — the session cookie is now set.
      // Force a full page reload so useSession picks up the new session
      // immediately (it doesn't auto-poll, so without this the spinner
      // would spin forever waiting for the session to update).
      window.location.reload();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <BrandMark size="lg" />
        <p className="micro-label">Inventory Platform</p>
      </div>

      <div className="glass-card w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-1 rounded-full p-1" style={{ border: "1px solid var(--color-border)" }}>
          <TabButton active={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>
            Sign in
          </TabButton>
          <TabButton active={mode === "signup"} onClick={() => { setMode("signup"); setError(null); }}>
            Create account
          </TabButton>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <Field
              icon={<UserIcon size={16} />}
              label="Full name"
              type="text"
              value={name}
              onChange={setName}
              placeholder="Sarah Tan"
              autoComplete="name"
              required
            />
          )}
          <Field
            icon={<Mail size={16} />}
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
          <Field
            icon={<Lock size={16} />}
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />

          {error && (
            <p
              className="text-sm"
              style={{ color: "var(--color-danger)" }}
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-teal mt-1 flex h-11 items-center justify-center gap-2 text-sm"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account & sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--color-text-low)" }}>
          {mode === "login"
            ? "No account yet? Tap “Create account”."
            : "Every action you take is recorded in the audit trail."}
        </p>
      </div>

      <p
        className="mt-8 max-w-xs text-center text-xs leading-relaxed"
        style={{ color: "var(--color-text-low)" }}
      >
        Point your camera at any tool. TOOLDECK identifies it and files it — or
        finds it if it already exists.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-full py-2 text-sm font-medium transition-all"
      style={{
        background: active ? "var(--color-teal)" : "transparent",
        color: active ? "#04211d" : "var(--color-text-mid)",
      }}
    >
      {children}
    </button>
  );
}

function Field({
  icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="micro-label">{label}</span>
      <div
        className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 transition-colors focus-within:border-[rgba(25,227,196,0.5)]"
        style={{
          border: "1px solid var(--color-border)",
          background: "rgba(6,17,17,0.6)",
        }}
      >
        <span style={{ color: "var(--color-text-low)" }}>{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-low)]"
          style={{ color: "var(--color-text-hi)" }}
        />
      </div>
    </label>
  );
}
