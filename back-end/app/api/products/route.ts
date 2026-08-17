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

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { product_id: "asc" },
    });

    return NextResponse.json(products, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_name, category, cost_price, retail_price } = body;

    if (!product_name || !category || cost_price === undefined || retail_price === undefined) {
      return NextResponse.json(
        { error: "product_name, category, cost_price and retail_price are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const product = await prisma.product.create({
      data: {
        product_name: String(product_name),
        category: String(category),
        cost_price: Number(cost_price),
        retail_price: Number(retail_price),
      },
    });

    return NextResponse.json(product, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500, headers: corsHeaders },
    );
  }
}
