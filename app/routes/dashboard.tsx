import { Form, Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const passkeyCount = await db.passkey.count({ where: { userId: user.id } });
  return {
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
    hasPasskeys: passkeyCount > 0,
  };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user, hasPasskeys } = loaderData;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-on-background">
            Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Profile
            </Link>
            <Form method="post" action="/auth/logout">
              <button
                type="submit"
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Sign out
              </button>
            </Form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {user.isAdmin && (
          <Link
            to="/admin/users"
            className="inline-flex items-center rounded-lg border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Manage users
          </Link>
        )}
        <div className="bg-surface rounded-xl border border-outline-variant p-6">
          <h2 className="text-sm font-medium text-on-surface-variant mb-1">
            Signed in as
          </h2>
          <p className="text-on-surface font-medium">{user.email}</p>
        </div>

        {!hasPasskeys && (
          <div className="bg-surface rounded-xl border border-outline-variant p-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">
                Secure your account
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Add a passkey for faster, passwordless sign-in on this device.
              </p>
            </div>
            <Link
              to="/profile"
              className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              Set up a passkey
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
