"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, KeyRound, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/secrets", label: "Secrets", icon: KeyRound },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      <aside className="w-52 shrink-0">
        <div className="sticky top-24">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Shield size={15} className="text-amber-400" />
            <span className="text-sm font-semibold text-zinc-300">Admin</span>
          </div>
          <nav className="space-y-0.5">
            {adminNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === href
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
