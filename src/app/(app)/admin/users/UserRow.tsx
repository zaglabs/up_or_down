"use client";

import type { User } from "@prisma/client";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-amber-400",
  TRADER: "text-emerald-400",
  VIEWER: "text-zinc-400",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-900/40 text-emerald-400",
  PENDING: "bg-amber-900/40 text-amber-400",
  DISABLED: "bg-zinc-800 text-zinc-500",
};

export function UserRow({ user }: { user: User }) {
  const patch = async (data: Record<string, string>) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    window.location.reload();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${user.email}?`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <tr className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50">
      <td className="px-4 py-3 text-zinc-100 font-mono text-xs">{user.email}</td>
      <td className="px-4 py-3 text-zinc-400 text-sm">{user.name ?? "—"}</td>
      <td className="px-4 py-3">
        <select
          value={user.role}
          onChange={(e) => patch({ role: e.target.value })}
          className={`bg-transparent text-xs font-medium cursor-pointer focus:outline-none ${ROLE_COLORS[user.role] ?? "text-zinc-400"}`}
        >
          <option value="VIEWER" className="bg-zinc-900 text-zinc-100">User</option>
          <option value="TRADER" className="bg-zinc-900 text-zinc-100">Trader</option>
          <option value="ADMIN" className="bg-zinc-900 text-zinc-100">Admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[user.status] ?? ""}`}>
          {user.status}
        </span>
      </td>
      <td className="px-4 py-3 text-zinc-500 text-xs">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {user.status === "PENDING" && (
            <button
              onClick={() => patch({ status: "ACTIVE" })}
              className="text-xs text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
            >
              Approve
            </button>
          )}
          {user.status === "ACTIVE" && (
            <button
              onClick={() => patch({ status: "DISABLED" })}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Disable
            </button>
          )}
          {user.status === "DISABLED" && (
            <button
              onClick={() => patch({ status: "ACTIVE" })}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Re-enable
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-xs text-red-500 hover:text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
