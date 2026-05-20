"use client";

import type { User } from "@prisma/client";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-amber-400",
  TRADER: "text-emerald-400",
  VIEWER: "text-zinc-400",
};

export function UserRow({ user }: { user: User }) {
  const handleDelete = async () => {
    if (!confirm(`Delete ${user.email}?`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <tr className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50">
      <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{user.email}</td>
      <td className="px-4 py-3 text-zinc-400">{user.name ?? "—"}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${ROLE_COLORS[user.role] ?? "text-zinc-400"}`}>
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3 text-zinc-500 text-xs">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleDelete}
          className="text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
