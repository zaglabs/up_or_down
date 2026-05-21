import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { edgeAuthConfig } from "./edge-config";

// Full Node.js config — includes Prisma. NOT imported by middleware.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...edgeAuthConfig,
  providers: [
    Credentials({
      credentials: { email: {}, code: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const code = String(credentials?.code ?? "");
        if (!email || !code) return null;

        const otp = await db.otpCode.findFirst({
          where: { email, code, used: false, expiresAt: { gt: new Date() } },
        });
        if (!otp) return null;

        await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name ?? null, role: user.role };
      },
    }),
  ],
  callbacks: {
    ...edgeAuthConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
      } else if (token.id) {
        // Re-fetch role on every token refresh so admin promotions take effect
        // without requiring the user to sign out.
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
  },
});

