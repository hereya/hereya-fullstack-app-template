import { useState } from "react";
import { Form, redirect, useNavigation, useSubmit } from "react-router";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Route } from "./+types/login";
import { getUserId, getLoginCodeCookie } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { sendLoginCodeEmail } from "~/lib/mail.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) {
    return redirect("/dashboard");
  }
  const url = new URL(request.url);
  return { redirectTo: url.searchParams.get("redirectTo") };
}

export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address" };
  }

  const db = getDb();
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

  const loginCode = await db.loginCode.create({
    data: { code, email },
  });

  await sendLoginCodeEmail(email, code).catch(() => null);

  const token = jwt.sign({ id: loginCode.id }, process.env.SESSION_SECRET!, {
    expiresIn: "10m",
  });

  const loginCodeCookie = getLoginCodeCookie();
  const codeUrl = `/auth/code${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`;

  return redirect(codeUrl, {
    headers: {
      "Set-Cookie": await loginCodeCookie.serialize(token),
    },
  });
}

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  async function handlePasskeyLogin() {
    setPasskeyError(null);
    try {
      const optionsRes = await fetch("/auth/passkey/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "options" }),
      });
      const options = await optionsRes.json();

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const authResponse = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/auth/passkey/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", response: authResponse }),
      });

      if (verifyRes.redirected) {
        window.location.href = verifyRes.url;
        return;
      }

      const result = await verifyRes.json();
      if (result.redirect) {
        window.location.href = result.redirect;
      } else {
        setPasskeyError(result.error || "Passkey authentication failed");
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "NotAllowedError") return;
      setPasskeyError("Passkey authentication failed. Try email instead.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-on-background text-center mb-8">
          Sign in
        </h1>

        <div className="bg-surface rounded-xl border border-outline-variant p-6 space-y-6">
          <Form method="post" className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-on-surface mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="you@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const form = e.currentTarget.form;
                    if (form) submit(form);
                  }
                }}
              />
            </div>

            {actionData && typeof actionData === "object" && "error" in actionData && (
              <p className="text-sm text-error text-center">
                {actionData.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Sending code..." : "Continue with email"}
            </button>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-surface px-2 text-on-surface-variant">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePasskeyLogin}
            className="w-full rounded-lg border border-outline-variant bg-surface px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            Sign in with passkey
          </button>

          {passkeyError && (
            <p className="text-sm text-error text-center">{passkeyError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
