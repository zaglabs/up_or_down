import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — no Node.js modules (no bcryptjs, no Prisma).
// Used only by middleware for JWT verification.
export const edgeAuthConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAdmin =
        nextUrl.pathname.startsWith("/admin") ||
        nextUrl.pathname.startsWith("/api/admin");
      if (!isAdmin) return true;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      return !!auth && role === "ADMIN";
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [],
};
