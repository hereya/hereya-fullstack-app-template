import { createUserSession } from "~/lib/auth.server";
import { getDb } from "~/lib/db.server";
import {
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
} from "~/lib/webauthn.server";
import { createCookieSessionStorage } from "react-router";

export async function action({ request }: { request: Request }) {
  const body = await request.json();

  const challengeStorage = createCookieSessionStorage({
    cookie: {
      name: "__webauthn-challenge",
      httpOnly: true,
      maxAge: 5 * 60,
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET!],
      secure: process.env.NODE_ENV === "production",
    },
  });

  if (body.action === "options") {
    const options = await generatePasskeyAuthenticationOptions();

    const challengeSession = await challengeStorage.getSession();
    challengeSession.set("challenge", options.challenge);

    return new Response(JSON.stringify(options), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": await challengeStorage.commitSession(challengeSession),
      },
    });
  }

  if (body.action === "verify") {
    const challengeSession = await challengeStorage.getSession(
      request.headers.get("cookie")
    );
    const expectedChallenge = challengeSession.get("challenge");

    if (!expectedChallenge) {
      return Response.json({ error: "Challenge expired" }, { status: 400 });
    }

    const { verified, userId } = await verifyPasskeyAuthentication(
      body.response,
      expectedChallenge
    );

    if (verified && userId) {
      const db = getDb();
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user?.isActive) {
        return new Response(
          JSON.stringify({ error: "Account deactivated" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                await challengeStorage.destroySession(challengeSession),
            },
          }
        );
      }
    }

    if (!verified || !userId) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              await challengeStorage.destroySession(challengeSession),
          },
        }
      );
    }

    // Create session and return redirect URL
    const sessionResponse = await createUserSession(userId, "/dashboard");

    // Append the challenge cookie cleanup
    sessionResponse.headers.append(
      "Set-Cookie",
      await challengeStorage.destroySession(challengeSession)
    );

    // Return JSON with redirect for the client-side fetch
    return new Response(JSON.stringify({ redirect: "/dashboard" }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionResponse.headers.get("Set-Cookie")!,
      },
    });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
