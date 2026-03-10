import { requireUser } from "~/lib/auth.server";
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from "~/lib/webauthn.server";
import { createCookieSessionStorage } from "react-router";

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
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
    const options = await generatePasskeyRegistrationOptions(user.id);

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

    const verification = await verifyPasskeyRegistration(
      user.id,
      body.response,
      expectedChallenge
    );

    return new Response(
      JSON.stringify({ verified: verification.verified, passkeyId: verification.passkeyId }),
      {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": await challengeStorage.destroySession(challengeSession),
        },
      }
    );
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
