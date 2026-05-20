import { db } from "@/lib/db";
import { UserRow } from "./UserRow";
import { CreateUserForm } from "./CreateUserForm";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await db.user.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const pending = users.filter((u) => u.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
          {pending > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-zinc-900">
              {pending} pending
            </span>
          )}
        </div>
      </div>

      <CreateUserForm />

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Name</th>
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Role</th>
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Created</th>
              <th className="px-4 py-3 text-right text-xs text-zinc-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
