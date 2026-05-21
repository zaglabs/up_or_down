"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Settings, TrendingUp, Shield } from "lucide-react";
import { ModeToggle } from "./ModeToggle";
import { usePaperStore } from "@/store/paper-store";
import { useAppStore } from "@/store/app-store";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { portfolio } = usePaperStore();
  const { mode } = useAppStore();

  const navLinks = [
    { href: "/dashboard", label: "Markets", icon: TrendingUp },
    { href: "/portfolio", label: "Portfolio", icon: BarChart2 },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/admin", label: "Admin", icon: Shield },
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
                  pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
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
        </div>
      </div>
    </header>
  );
}
