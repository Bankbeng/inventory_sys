import { NextResponse } from "next/server";

import { corsHeaders } from "@/lib/cors";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { withoutPassword } from "@/lib/staff";
import { requireStaffApiAccess } from "@/lib/staff-api-auth";

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const accessError = await requireStaffApiAccess(request);
    if (accessError) {
      return accessError;
    }

    const staff = await prisma.staff.findMany({
      orderBy: { staff_id: "asc" },
    });

    return NextResponse.json(staff.map(withoutPassword), { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch staff records" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const accessError = await requireStaffApiAccess(request, true);
    if (accessError) {
      return accessError;
    }

    const body = await request.json();
    const { staff_name, username, password, role } = body;

    if (!staff_name || !username || !password || !role) {
      return NextResponse.json(
        { error: "staff_name, username, password and role are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const staff = await prisma.staff.create({
      data: {
        staff_name: String(staff_name),
        username: String(username).trim(),
        password: await hashPassword(String(password)),
        role: String(role),
      },
    });

    return NextResponse.json(withoutPassword(staff), { status: 201, headers: corsHeaders });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { error: "Failed to create staff record" },
      { status: 500, headers: corsHeaders },
    );
  }
}
