import { useRef, useState } from "react";
import { Form, redirect, useFetcher, useNavigation } from "react-router";
import jwt from "jsonwebtoken";
import type { Route } from "./+types/code";
import {
  getUserId,
  getLoginCodeCookie,
  createUserSession,
} from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import { sendLoginCodeEmail } from "~/lib/mail.server";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) {
    return redirect("/dashboard");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/dashboard";
  const formData = await request.formData();
  const actionType = formData.get("action");

  const loginCodeCookie = getLoginCodeCookie();
  const token = await loginCodeCookie.parse(request.headers.get("cookie"));

  if (!token) {
    return redirect("/auth/login");
  }

  if (actionType === "resend") {
    try {
      const { id } = jwt.verify(token, process.env.SESSION_SECRET!) as {
        id: string;
      };
      const db = getDb();
      const loginCode = await db.loginCode.findUnique({ where: { id } });
      if (loginCode) {
        await sendLoginCodeEmail(loginCode.email, loginCode.code).catch(
          () => null
        );
      }
    } catch {
      // Token expired or invalid
    }
    return { resent: true };
  }

  // Verify code
  const code = String(formData.get("code") || "");
  if (code.length !== 6) {
    return { error: "Please enter a 6-digit code" };
  }

  try {
    const { id } = jwt.verify(token, process.env.SESSION_SECRET!) as {
      id: string;
    };
    const db = getDb();

    const result = await db.$transaction(async (tx) => {
      const loginCode = await tx.loginCode.findUnique({
        where: { id, code },
      });

      if (!loginCode) {
        return null;
      }

      let user = await tx.user.findUnique({
        where: { email: loginCode.email },
      });

      if (!user) {
        const userCount = await tx.user.count();
        user = await tx.user.create({
          data: { email: loginCode.email, isAdmin: userCount === 0 },
        });
      }

      await tx.loginCode.delete({ where: { id } });

      return user;
    });

    if (!result) {
      return { error: "Invalid code. Please try again." };
    }

    // Clear login code cookie and create session
    const response = await createUserSession(result.id, redirectTo);
    response.headers.append(
      "Set-Cookie",
      await loginCodeCookie.serialize("", { maxAge: 0 })
    );
    return response;
  } catch {
    return { error: "Code expired. Please request a new one." };
  }
}

export default function CodePage() {
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const isSubmitting = navigation.state === "submitting";
  const [codeValue, setCodeValue] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.replace(/\D/g, "").slice(0, 6);
      setCodeValue(pasted);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
    } else {
      const digits = codeValue.split("");
      digits[index] = value.replace(/\D/g, "");
      const updated = digits.join("").slice(0, 6);
      setCodeValue(updated);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !codeValue[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const actionData = navigation.formData
    ? undefined
    : (fetcher.data as { error?: string; resent?: boolean } | undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-on-background text-center mb-2">
          Check your email
        </h1>
        <p className="text-sm text-on-surface-variant text-center mb-8">
          We sent a 6-digit verification code to your email
        </p>

        <div className="bg-surface rounded-xl border border-outline-variant p-6 space-y-6">
          <Form method="post" className="space-y-4">
            <input type="hidden" name="action" value="code" />
            <input type="hidden" name="code" value={codeValue} />

            <div>
              <label className="block text-sm font-medium text-on-surface text-center mb-3">
                Enter verification code
              </label>
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]"
                    maxLength={index === 0 ? 6 : 1}
                    className="w-11 h-12 text-center text-lg font-semibold border border-outline-variant rounded-lg bg-surface text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    value={codeValue[index] || ""}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    autoFocus={index === 0}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {actionData?.error && (
              <p className="text-sm text-error text-center">
                {actionData.error}
              </p>
            )}

            <button
              type="submit"
              disabled={codeValue.length !== 6 || isSubmitting}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Verifying..." : "Verify code"}
            </button>
          </Form>

          <div className="text-center space-y-2">
            <ResendButton />
            <a
              href="/auth/login"
              className="block text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Back to login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResendButton() {
  const fetcher = useFetcher();
  const [timeLeft, setTimeLeft] = useState(30);
  const isResending = fetcher.state === "submitting";

  useState(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  });

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="action" value="resend" />
      <p className="text-sm text-on-surface-variant">
        Didn't receive the code?{" "}
        {timeLeft > 0 ? (
          <span>Resend in {timeLeft}s</span>
        ) : (
          <button
            type="submit"
            disabled={isResending}
            className="text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
          >
            {isResending ? "Sending..." : "Resend code"}
          </button>
        )}
      </p>
    </fetcher.Form>
  );
}
