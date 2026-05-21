"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/secret", label: "Secret", icon: ShieldCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Admin</h1>
        <p className="text-sm text-zinc-500 mt-1">System configuration and management</p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 pb-0">
        {adminNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
              pathname === href
                ? "border-zinc-100 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </div>

      <div>{children}</div>
    </div>
  );
}
