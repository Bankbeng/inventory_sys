import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "inventory_session";

function hasValidSession(token: string | undefined) {
  if (!token) {
    return false;
  }
  const secret = process.env.AUTH_SECRET
    ?? (process.env.NODE_ENV !== "production" ? "inventory-system-local-development-secret" : null);
  if (!secret) {
    console.error("AUTH_SECRET must be configured in production");
    return false;
  }

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return false;
  }
  try {
    const expectedSignature = createHmac("sha256", secret).update(payload).digest();
    const actualSignature = Buffer.from(signature, "base64url");
    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return false;
    }
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      staffId?: unknown;
      username?: unknown;
      staffName?: unknown;
      expiresAt?: unknown;
    };
    return (
      Number.isInteger(session.staffId) &&
      typeof session.username === "string" &&
      typeof session.staffName === "string" &&
      typeof session.expiresAt === "number" &&
      session.expiresAt > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const authenticated = hasValidSession(request.cookies.get(sessionCookieName)?.value);
  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";

  if (isLoginPage) {
    return authenticated
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  if (!authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (path === "/access-denied") {
    return NextResponse.next();
  }

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return fetch(`${apiUrl}/api/access-check?page=${encodeURIComponent(path)}`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
  }).then(async (response) => {
    if (response.status === 401) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to verify page permissions. Please try again later." },
        { status: 503 },
      );
    }
    const access = await response.json() as { allowed?: boolean };
    return access.allowed
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/access-denied", request.url));
  }).catch((error: unknown) => {
    console.error("Failed to verify page access", error);
    return NextResponse.json(
      { error: "Unable to verify page permissions. Please try again later." },
      { status: 503 },
    );
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
