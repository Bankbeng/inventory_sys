import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders } from "@/lib/cors";
import { getCurrentStaff, isAdminRole, pagesForApi } from "@/lib/permissions";
import { canAccessPage } from "@/lib/permissions";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const path = request.nextUrl.pathname;
  if (path === "/api/login" || path === "/api/logout") {
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(corsHeaders)) {
      response.headers.set(name, value);
    }
    return response;
  }

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: corsHeaders },
    );
  }

  const staff = await getCurrentStaff(session.staffId);
  if (!staff) {
    return NextResponse.json(
      { error: "Staff account not found" },
      { status: 401, headers: corsHeaders },
    );
  }

  if (path.startsWith("/api/role-permissions") && !isAdminRole(staff.role)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403, headers: corsHeaders },
    );
  }
  if (
    (path === "/api/staff" || path.startsWith("/api/staff/")) &&
    request.method !== "GET" &&
    !isAdminRole(staff.role)
  ) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403, headers: corsHeaders },
    );
  }

  const protectedPages = pagesForApi(path, request.method);
  if (
    protectedPages?.length &&
    !(await Promise.all(protectedPages.map((page) => canAccessPage(staff.role, page)))).some(Boolean)
  ) {
    return NextResponse.json(
      { error: "You do not have permission to access this data" },
      { status: 403, headers: corsHeaders },
    );
  }

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
