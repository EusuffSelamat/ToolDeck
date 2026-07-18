import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// NextAuth options — credentials provider backed by the local User table.
// JWT session strategy (no database sessions), so the gateway/edge is happy.
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        try {
          const user = await db.user.findUnique({ where: { email } });
          if (!user) return null;
          const ok = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!ok) return null;

          // Admin approval gate. Admins always bypass (they are provisioned
          // manually and must never be locked out). Everyone else must be
          // 'approved'. Throwing here surfaces a specific reason to the
          // sign-in screen via ?error=<message>.
          if (user.role !== "admin" && user.approvalStatus !== "approved") {
            throw new Error(
              user.approvalStatus === "rejected" ? "ACCOUNT_REJECTED" : "PENDING_APPROVAL"
            );
          }

          return { id: user.id, name: user.fullName, email: user.email, role: user.role };
        } catch (e) {
          // Re-throw our approval-gate signals so NextAuth forwards them as
          // the ?error= param; swallow only genuine/unexpected errors.
          if (e instanceof Error && (e.message === "PENDING_APPROVAL" || e.message === "ACCOUNT_REJECTED")) {
            throw e;
          }
          console.error("Auth authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = (user as { role?: string }).role ?? "worker";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        session.user.name = (token.name as string) ?? session.user.name;
        // Read the CURRENT role from the DB (not the token) so role changes
        // made by an admin reach the client UI on the next session refresh
        // without requiring the user to sign out and back in.
        let role = (token.role as string) ?? "worker";
        try {
          const fresh = await db.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          });
          if (fresh) role = fresh.role;
        } catch {
          // DB hiccup — fall back to the token's role.
        }
        (session.user as { role?: string }).role = role;
      }
      return session;
    },
  },
  // error: "/" routes auth failures (e.g. PENDING_APPROVAL thrown from
  // authorize) back to the themed sign-in screen as /?error=<code> instead
  // of NextAuth's unstyled default /api/auth/error page.
  pages: { signIn: "/", error: "/" },
};
