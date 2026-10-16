import { NextResponse } from "next/server";

import { getCurrentStaff, isAdminRole } from "@/lib/permissions";
import { getSessionFromRequest } from "@/lib/session";

export async function requireStaffApiAccess(request: Request, adminOnly = false) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const staff = await getCurrentStaff(session.staffId);
  if (!staff) {
    return NextResponse.json({ error: "Staff account not found" }, { status: 401 });
  }

  if (adminOnly && !isAdminRole(staff.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return null;
}
