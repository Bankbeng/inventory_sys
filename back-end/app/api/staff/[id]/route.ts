import { NextResponse } from "next/server";

import { corsHeaders } from "@/lib/cors";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { withoutPassword } from "@/lib/staff";
import { requireStaffApiAccess } from "@/lib/staff-api-auth";

function parseId(id: string) {
  const parsed = Number(id);

  if (!Number.isInteger(parsed)) {
    throw new Error("Invalid staff id");
  }

  return parsed;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const accessError = await requireStaffApiAccess(request);
    if (accessError) {
      return accessError;
    }

    const { id } = await params;
    const staff = await prisma.staff.findUnique({
      where: { staff_id: parseId(id) },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(withoutPassword(staff), { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch staff record" },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const accessError = await requireStaffApiAccess(request, true);
    if (accessError) {
      return accessError;
    }

    const { id } = await params;
    const body = await request.json();
    const staff = await prisma.staff.update({
      where: { staff_id: parseId(id) },
      data: {
        ...(body.staff_name !== undefined ? { staff_name: String(body.staff_name) } : {}),
        ...(body.username !== undefined ? { username: String(body.username).trim() } : {}),
        ...(typeof body.password === "string" && body.password
          ? { password: await hashPassword(body.password) }
          : {}),
        ...(body.role !== undefined ? { role: String(body.role) } : {}),
      },
    });

    return NextResponse.json(withoutPassword(staff), { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Staff not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update staff record" },
      { status: 400, headers: corsHeaders },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const accessError = await requireStaffApiAccess(request, true);
    if (accessError) {
      return accessError;
    }

    const { id } = await params;
    await prisma.staff.delete({
      where: { staff_id: parseId(id) },
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Staff not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete staff record" },
      { status: 400, headers: corsHeaders },
    );
  }
}
