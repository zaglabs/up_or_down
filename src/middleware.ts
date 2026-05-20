import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

// Use the edge-safe config so no Node.js modules (bcryptjs/Prisma) are bundled.
export default NextAuth(edgeAuthConfig).auth;

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
