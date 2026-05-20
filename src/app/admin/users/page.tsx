import { db } from "@/lib/db";
import { UserRow } from "./UserRow";
import { CreateUserForm } from "./CreateUserForm";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
      </div>

      <CreateUserForm />

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Name</th>
              <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Role</th>
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
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                  No users yet. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
