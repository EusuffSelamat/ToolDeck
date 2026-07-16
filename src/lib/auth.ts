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
          return { id: user.id, name: user.fullName, email: user.email, role: user.role };
        } catch (e) {
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
        (session.user as { role?: string }).role = (token.role as string) ?? "worker";
      }
      return session;
    },
  },
  pages: { signIn: "/" },
  trustHost: true,
};
