import { createCookieSessionStorage, redirect, createCookie } from "react-router";
import { getDb } from "./db.server";

type SessionData = {
  userId: string;
};

type SessionFlashData = {
  error: string;
};

function getSessionStorage() {
  return createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET!],
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export function getLoginCodeCookie() {
  return createCookie("__login-code", {
    httpOnly: true,
    maxAge: 10 * 60, // 10 minutes
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getSession(request: Request) {
  const sessionStorage = getSessionStorage();
  return sessionStorage.getSession(request.headers.get("cookie"));
}

export async function getUserId(request: Request): Promise<string | undefined> {
  const session = await getSession(request);
  return session.get("userId");
}

export async function requireUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    const url = new URL(request.url);
    throw redirect(`/auth/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  const db = getDb();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw await destroyUserSession(request);
  }

  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (!user.isAdmin) {
    throw redirect("/dashboard");
  }
  return user;
}

export async function createUserSession(userId: string, redirectTo: string) {
  const sessionStorage = getSessionStorage();
  const session = await sessionStorage.getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function destroyUserSession(request: Request) {
  const sessionStorage = getSessionStorage();
  const session = await sessionStorage.getSession(
    request.headers.get("cookie")
  );

  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
