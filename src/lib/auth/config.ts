import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { jwtVerify } from "jose";
import { db } from "@/lib/db";
import { edgeAuthConfig } from "./edge-config";

// Full Node.js config — includes Prisma. NOT imported by middleware.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...edgeAuthConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        code: {},
        token: {},
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const code = String(credentials?.code ?? "");
        const token = String(credentials?.token ?? "");
        if (!email || !code || !token) return null;

        try {
          const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");
          const { payload } = await jwtVerify(token, secret);
          if (payload.email !== email || payload.code !== code) return null;
        } catch {
          return null;
        }

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name ?? null, role: user.role };
      },
    }),
  ],
});
