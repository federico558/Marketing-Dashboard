import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

function emailAllowed(email: string): boolean {
  const raw = process.env.AUTH_ALLOWED_EMAILS;
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        if (!emailAllowed(email)) return null;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && existing.passwordHash) {
          const ok = await bcrypt.compare(password, existing.passwordHash);
          if (!ok) return null;
          return { id: existing.id, email: existing.email, name: existing.name ?? undefined };
        }

        const passwordHash = await bcrypt.hash(password, 10);
        if (existing) {
          const updated = await prisma.user.update({
            where: { id: existing.id },
            data: { passwordHash },
          });
          return { id: updated.id, email: updated.email, name: updated.name ?? undefined };
        }
        const created = await prisma.user.create({
          data: { email, passwordHash },
        });
        return { id: created.id, email: created.email, name: created.name ?? undefined };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
