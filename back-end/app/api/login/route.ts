import { NextResponse } from "next/server";

import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { withoutPassword } from "@/lib/staff";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/session";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const staff = await prisma.staff.findUnique({
      where: { username },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401, headers: corsHeaders },
      );
    }

    const passwordCheck = await verifyPassword(password, staff.password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401, headers: corsHeaders },
      );
    }

    if (passwordCheck.needsRehash) {
      await prisma.staff.update({
        where: { staff_id: staff.staff_id },
        data: { password: await hashPassword(password) },
      });
    }

    const safeStaff = withoutPassword(staff);
    const response = NextResponse.json(
      {
        message: "Login successful",
        user: safeStaff,
      },
      { headers: corsHeaders },
    );
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken({
      staffId: staff.staff_id,
      username: staff.username,
      staffName: staff.staff_name,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Login failed",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
