import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "inventory_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type SessionPayload = {
  staffId: number;
  username: string;
  staffName: string;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV !== "production") {
    return "inventory-system-local-development-secret";
  }
  throw new Error("AUTH_SECRET must be configured in production");
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user: Omit<SessionPayload, "expiresAt">) {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    } satisfies SessionPayload),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) {
    return null;
  }
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return null;
  }
  try {
    const expectedSignature = Buffer.from(sign(payload), "base64url");
    const actualSignature = Buffer.from(signature, "base64url");
    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (
      !Number.isInteger(parsed.staffId) ||
      typeof parsed.username !== "string" ||
      typeof parsed.staffName !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const cookieValue = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  return verifySessionToken(cookieValue);
}
