import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

export default NextAuth(edgeAuthConfig).auth;

export const config = {
  // Protect everything except login, setup, auth callbacks, and Next.js internals
  matcher: ["/((?!login|setup|api/auth|api/setup|_next|favicon\\.ico).*)"],
};
