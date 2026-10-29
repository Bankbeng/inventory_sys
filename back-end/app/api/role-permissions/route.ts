import { NextResponse } from "next/server";

import { APP_PAGES, isAdminRole, normalizeRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/permissions";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

async function getAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  const session = verifySessionToken(cookieValue ? decodeURIComponent(cookieValue) : undefined);
  if (!session) {
    return null;
  }
  const staff = await getCurrentStaff(session.staffId);
  return staff && isAdminRole(staff.role) ? staff : null;
}

export async function GET(request: Request) {
  try {
    if (!(await getAdmin(request))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const [staffRoles, storedPermissions] = await Promise.all([
      prisma.staff.findMany({ distinct: ["role"], select: { role: true }, orderBy: { role: "asc" } }),
      prisma.rolePagePermission.findMany(),
    ]);
    const roles = staffRoles
      .map(({ role }) => role.trim())
      .filter((role) => role && !isAdminRole(role))
      .map((role) => {
        const normalizedRole = normalizeRole(role);
        const permissions = storedPermissions.filter((permission) => permission.role_name === normalizedRole);
        const configurablePages = APP_PAGES.filter(
          ({ path }) => path !== "/staff",
        );
        const accessiblePages = permissions.length === 0
          ? configurablePages
              .filter(({ path }) => path !== "/sales-management")
              .map(({ path }) => path)
          : permissions
              .filter(({ can_access, page_path }) =>
                can_access && page_path !== "/staff",
              )
              .map(({ page_path }) => page_path);
        return { role_name: role, accessible_pages: accessiblePages };
      });
    return NextResponse.json({
      pages: APP_PAGES.filter(({ path }) => path !== "/staff"),
      roles,
    });
  } catch (error) {
    console.error("Failed to fetch role permissions", error);
    return NextResponse.json({ error: "Failed to fetch role permissions" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await getAdmin(request))) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const body = await request.json();
    const roleName = typeof body.role_name === "string" ? normalizeRole(body.role_name) : "";
    const accessiblePages: unknown = body.accessible_pages;
    if (!roleName || roleName.length > 191 || isAdminRole(roleName)) {
      return NextResponse.json({ error: "A valid non-admin role is required" }, { status: 400 });
    }
    if (
      !Array.isArray(accessiblePages) ||
      accessiblePages.some(
        (page) => typeof page !== "string" ||
          page === "/staff" ||
          !APP_PAGES.some((knownPage) => knownPage.path === page),
      )
    ) {
      return NextResponse.json({ error: "Invalid page permissions" }, { status: 400 });
    }

    await prisma.$transaction(
      APP_PAGES.filter(({ path }) => path !== "/staff").map(({ path }) =>
        prisma.rolePagePermission.upsert({
          where: { role_name_page_path: { role_name: roleName, page_path: path } },
          create: { role_name: roleName, page_path: path, can_access: accessiblePages.includes(path) },
          update: { can_access: accessiblePages.includes(path) },
        }),
      ),
    );
    return NextResponse.json({ success: true, role_name: roleName });
  } catch (error) {
    console.error("Failed to save role permissions", error);
    return NextResponse.json({ error: "Failed to save role permissions" }, { status: 500 });
  }
}
