import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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

    if (!staff || staff.password !== password) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401, headers: corsHeaders },
      );
    }

    const { password: _password, ...safeStaff } = staff;

    return NextResponse.json(
      {
        message: "Login successful",
        user: safeStaff,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Login failed",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
