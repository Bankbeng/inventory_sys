import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/permissions";
import { getSessionFromRequest } from "@/lib/session";
import { corsHeaders } from "@/lib/cors";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
  }
  const staff = await getCurrentStaff(session.staffId);
  if (!staff) {
    return NextResponse.json({ error: "Staff account not found" }, { status: 401, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 50);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: "page must be a positive integer and pageSize must be between 1 and 100" },
        { status: 400, headers: corsHeaders },
      );
    }

    const [items, totalItems] = await Promise.all([
      prisma.deletedSalesOrder.findMany({
        orderBy: [{ deleted_at: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.deletedSalesOrder.count(),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch deleted sales order history", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted sales order history" },
      { status: 500, headers: corsHeaders },
    );
  }
}
