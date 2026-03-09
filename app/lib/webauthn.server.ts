import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { getDb } from "./db.server";

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
type RegistrationResponseJSON = Parameters<typeof verifyRegistrationResponse>[0]["response"];
type AuthenticationResponseJSON = Parameters<typeof verifyAuthenticationResponse>[0]["response"];

function getRpConfig() {
  const appUrl = process.env.APP_URL || "http://localhost:5177";
  const url = new URL(appUrl);
  return {
    rpName: "Hereya App",
    rpID: url.hostname,
    origin: appUrl,
  };
}

export async function generatePasskeyRegistrationOptions(userId: string) {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const existingPasskeys = await db.passkey.findMany({
    where: { userId },
  });

  const { rpName, rpID } = getRpConfig();

  return generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.email,
    excludeCredentials: existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  const { rpID, origin } = getRpConfig();

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential } = verification.registrationInfo;
    const db = getDb();

    await db.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: response.response.transports ?? [],
      },
    });
  }

  return verification;
}

export async function generatePasskeyAuthenticationOptions() {
  const { rpID } = getRpConfig();

  return generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string
): Promise<{ verified: boolean; userId?: string }> {
  const { rpID, origin } = getRpConfig();
  const db = getDb();

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
  });

  if (!passkey) {
    return { verified: false };
  }

  const verification: VerifiedAuthenticationResponse =
    await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.credentialPublicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

  if (verification.verified) {
    await db.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });
  }

  return { verified: verification.verified, userId: passkey.userId };
}
