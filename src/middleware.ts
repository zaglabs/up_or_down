import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

export default NextAuth(edgeAuthConfig).auth;

export const config = {
  // Protect everything except login, setup, auth callbacks, and Next.js internals
  matcher: ["/((?!login|register|setup|api/auth|api/setup|api/register|_next|favicon\\.ico).*)"],
};
