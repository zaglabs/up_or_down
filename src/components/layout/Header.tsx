"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, TrendingUp, ShieldCheck, LogOut } from "lucide-react";
import { ModeToggle } from "./ModeToggle";
import { usePaperStore } from "@/store/paper-store";
import { useAppStore } from "@/store/app-store";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";

export function Header() {
  const pathname = usePathname();
  const { portfolio } = usePaperStore();
  const { mode } = useAppStore();
  const { data: session } = useSession();

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const navLinks = [
    { href: "/dashboard", label: "Markets", icon: TrendingUp },
    { href: "/portfolio", label: "Portfolio", icon: BarChart2 },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-zinc-100">
            <span className="text-emerald-400">▲▼</span>
            <span>UpOrDown</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith(href)
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <ShieldCheck size={14} />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {mode === "paper" && (
            <div className="hidden text-sm sm:block">
              <span className="text-zinc-500">Balance: </span>
              <span className="font-mono font-semibold text-zinc-100">
                {formatCurrency(portfolio.balance)}
              </span>
            </div>
          )}
          <ModeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
