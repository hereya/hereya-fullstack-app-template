import { useState } from "react";
import { Form } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user: { id: user.id, email: user.email, isAdmin: user.isAdmin } };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null);

  async function handleRegisterPasskey() {
    setPasskeyStatus(null);
    try {
      const optionsRes = await fetch("/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "options" }),
      });
      const options = await optionsRes.json();

      const { startRegistration } = await import("@simplewebauthn/browser");
      const regResponse = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", response: regResponse }),
      });
      const result = await verifyRes.json();

      if (result.verified) {
        setPasskeyStatus("Passkey registered successfully!");
      } else {
        setPasskeyStatus("Failed to register passkey.");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "NotAllowedError") return;
      setPasskeyStatus("Failed to register passkey.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-outline-variant">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-on-background">
            Dashboard
          </h1>
          <Form method="post" action="/auth/logout">
            <button
              type="submit"
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Sign out
            </button>
          </Form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {user.isAdmin && (
          <a
            href="/admin/users"
            className="inline-flex items-center rounded-lg border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Manage users
          </a>
        )}
        <div className="bg-surface rounded-xl border border-outline-variant p-6">
          <h2 className="text-sm font-medium text-on-surface-variant mb-1">
            Signed in as
          </h2>
          <p className="text-on-surface font-medium">{user.email}</p>
        </div>

        <div className="bg-surface rounded-xl border border-outline-variant p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              Passkeys
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Add a passkey for faster, passwordless sign-in on this device.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRegisterPasskey}
            className="rounded-lg border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            Register a passkey
          </button>

          {passkeyStatus && (
            <p
              className={`text-sm ${passkeyStatus.includes("successfully") ? "text-primary" : "text-error"}`}
            >
              {passkeyStatus}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
