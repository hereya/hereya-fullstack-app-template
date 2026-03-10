import { useState } from "react";
import { Form, Link, useFetcher, useRevalidator, useSearchParams } from "react-router";
import type { Route } from "./+types/profile";
import { requireUser } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const passkeys = await db.passkey.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    user: { id: user.id, email: user.email },
    passkeys: passkeys.map((pk) => ({
      ...pk,
      createdAt: pk.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const db = getDb();
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "rename-passkey") {
    const passkeyId = formData.get("passkeyId") as string;
    const name = (formData.get("name") as string)?.trim();

    if (!name || name.length === 0) {
      return { error: "Name cannot be empty" };
    }
    if (name.length > 50) {
      return { error: "Name must be 50 characters or less" };
    }

    await db.passkey.update({
      where: { id: passkeyId, userId: user.id },
      data: { name },
    });

    return { success: true };
  }

  if (intent === "delete-passkey") {
    const passkeyId = formData.get("passkeyId") as string;

    await db.passkey.delete({
      where: { id: passkeyId, userId: user.id },
    });

    return { success: true };
  }

  return { error: "Invalid action" };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, passkeys } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [passkeyStatus, setPasskeyStatus] = useState<string | null>(null);
  const [newPasskeyId, setNewPasskeyId] = useState<string | null>(
    searchParams.get("newPasskey")
  );
  const revalidator = useRevalidator();

  // Clear the query param once we've captured it
  if (searchParams.has("newPasskey")) {
    setSearchParams({}, { replace: true });
  }

  async function handleRegisterPasskey() {
    setPasskeyStatus(null);
    setNewPasskeyId(null);
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
        setPasskeyStatus("Passkey registered! Give it a name:");
        setNewPasskeyId(result.passkeyId);
        revalidator.revalidate();
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
          <h1 className="text-lg font-semibold text-on-background">Profile</h1>
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Dashboard
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
        <div className="bg-surface rounded-xl border border-outline-variant p-6">
          <h2 className="text-sm font-medium text-on-surface-variant mb-1">
            Email
          </h2>
          <p className="text-on-surface font-medium">{user.email}</p>
        </div>

        <div className="bg-surface rounded-xl border border-outline-variant p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              Passkeys
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Passkeys let you sign in quickly and securely without a code.
            </p>
          </div>

          {passkeys.length === 0 && !newPasskeyId && (
            <div className="rounded-lg border border-dashed border-outline-variant p-4 text-center">
              <p className="text-sm text-on-surface-variant">
                You don't have any passkeys yet. Register one to sign in
                faster.
              </p>
            </div>
          )}

          {passkeys.length > 0 && (
            <div className="divide-y divide-outline-variant">
              {passkeys.map((passkey) => (
                <PasskeyRow
                  key={passkey.id}
                  passkey={passkey}
                  isNewlyCreated={passkey.id === newPasskeyId}
                  onNamed={() => setNewPasskeyId(null)}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleRegisterPasskey}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            Register a passkey
          </button>

          {passkeyStatus && !newPasskeyId && (
            <p
              className={`text-sm ${passkeyStatus.includes("registered") ? "text-primary" : "text-error"}`}
            >
              {passkeyStatus}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function PasskeyRow({
  passkey,
  isNewlyCreated,
  onNamed,
}: {
  passkey: { id: string; name: string; createdAt: string };
  isNewlyCreated: boolean;
  onNamed: () => void;
}) {
  const renameFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(isNewlyCreated);
  const [editName, setEditName] = useState(passkey.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDeleted = deleteFetcher.state !== "idle";

  if (isDeleted) return null;

  function handleSaveName() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    renameFetcher.submit(
      { intent: "rename-passkey", passkeyId: passkey.id, name: trimmed },
      { method: "post" }
    );
    setIsEditing(false);
    if (isNewlyCreated) onNamed();
  }

  function handleDelete() {
    deleteFetcher.submit(
      { intent: "delete-passkey", passkeyId: passkey.id },
      { method: "post" }
    );
    setConfirmDelete(false);
  }

  const formattedDate = new Date(passkey.createdAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <div className="flex items-center justify-between py-3 gap-3">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditName(passkey.name);
                  if (isNewlyCreated) onNamed();
                }
              }}
              maxLength={50}
              autoFocus
              className="w-full max-w-xs rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleSaveName}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditName(passkey.name);
                if (isNewlyCreated) onNamed();
              }}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-on-surface truncate">
              {renameFetcher.formData
                ? (renameFetcher.formData.get("name") as string)
                : passkey.name}
            </p>
            <p className="text-xs text-on-surface-variant">
              Added {formattedDate}
            </p>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <span className="text-xs text-error">Delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-on-error hover:bg-error/90 transition-colors"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-error hover:text-error/80 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
