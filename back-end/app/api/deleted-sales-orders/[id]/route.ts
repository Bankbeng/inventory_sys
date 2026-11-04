import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/permissions";
import { getSessionFromRequest } from "@/lib/session";
import { corsHeaders } from "@/lib/cors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
  }
  const staff = await getCurrentStaff(session.staffId);
  if (!staff) {
    return NextResponse.json({ error: "Staff account not found" }, { status: 401, headers: corsHeaders });
  }

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Valid deleted order id is required" }, { status: 400, headers: corsHeaders });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400, headers: corsHeaders });
    }
    const note = (body as Record<string, unknown>).note;
    if (typeof note !== "string" || note.length > 2000) {
      return NextResponse.json({ error: "note must be a string of 2000 characters or fewer" }, { status: 400, headers: corsHeaders });
    }

    const record = await prisma.deletedSalesOrder.update({
      where: { id },
      data: { note: note.trim() || null },
    });
    return NextResponse.json(record, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Deleted sales order not found" }, { status: 404, headers: corsHeaders });
    }
    console.error("Failed to update deleted sales order note", error);
    return NextResponse.json(
      { error: "Failed to update deleted sales order note" },
      { status: 500, headers: corsHeaders },
    );
  }
}
