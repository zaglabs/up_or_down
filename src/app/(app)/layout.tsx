import { SessionProvider } from "next-auth/react";
import { Header } from "@/components/layout/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </SessionProvider>
  );
}
