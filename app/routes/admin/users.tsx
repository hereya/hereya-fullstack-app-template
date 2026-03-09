import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/users";
import { requireAdmin } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireAdmin(request);
  const db = getDb();
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      isAdmin: true,
      isActive: true,
      createdAt: true,
    },
  });
  return { users, adminId: admin.id };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");
  const userId = String(formData.get("userId") || "");
  const db = getDb();

  if (actionType === "toggle-active") {
    if (userId === admin.id) {
      return { error: "Cannot modify yourself", userId };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { error: "User not found", userId };
    }

    await db.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
    return { success: true };
  }

  return { error: "Invalid action" };
}

export default function AdminUsers({ loaderData, actionData }: Route.ComponentProps) {
  const { users, adminId } = loaderData;
  const navigation = useNavigation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-on-background">
            User Management
          </h1>
          <a
            href="/dashboard"
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Back to dashboard
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <span className="text-sm text-on-surface">
                      {user.email}
                    </span>
                    {actionData &&
                      "error" in actionData &&
                      actionData.userId === user.id && (
                        <p className="text-xs text-error mt-1">
                          {actionData.error}
                        </p>
                      )}
                  </td>
                  <td className="px-4 py-3">
                    {user.isAdmin ? (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Admin
                      </span>
                    ) : (
                      <span className="text-xs text-on-surface-variant">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.id !== adminId && (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="action"
                          value="toggle-active"
                        />
                        <input
                          type="hidden"
                          name="userId"
                          value={user.id}
                        />
                        <button
                          type="submit"
                          disabled={navigation.state === "submitting"}
                          className={`text-xs font-medium transition-colors ${
                            user.isActive
                              ? "text-error hover:text-error/80"
                              : "text-primary hover:text-primary/80"
                          }`}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
