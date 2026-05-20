import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/config";
import { LayoutDashboard, Users, Activity, BookOpen, LogOut } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/logs", label: "Logs", icon: Activity },
  { href: "/admin/watchlist", label: "Watchlist", icon: BookOpen },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-4 py-5 border-b border-zinc-800">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Admin</p>
          <p className="text-xs text-zinc-600 mt-0.5 truncate">{session.user?.email}</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-zinc-800">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
