import { NextResponse } from "next/server";

import { APP_PAGES, getAllowedPages, getCurrentStaff } from "@/lib/permissions";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page");
  const listAllPages = url.searchParams.get("all") === "true";
  if (!listAllPages && (!page || !APP_PAGES.some(({ path }) => path === page))) {
    return NextResponse.json({ error: "A valid page is required" }, { status: 400 });
  }

  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const staff = await getCurrentStaff(session.staffId);
    if (!staff) {
      return NextResponse.json({ error: "Staff account not found" }, { status: 401 });
    }
    const allowedPages = await getAllowedPages(staff.role);
    const allowed = listAllPages || allowedPages.includes(page ?? "");
    return NextResponse.json({
      allowed,
      role: staff.role,
      isAdmin: staff.role.trim().toLocaleLowerCase() === "admin",
      staff_id: staff.staff_id,
      staff_name: staff.staff_name,
      allowed_pages: allowedPages,
    });
  } catch (error) {
    console.error("Failed to check page permission", error);
    return NextResponse.json({ error: "Failed to check page permission" }, { status: 500 });
  }
}
