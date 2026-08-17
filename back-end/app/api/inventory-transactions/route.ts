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
    const transactions = await prisma.inventoryTransaction.findMany({
      orderBy: { transaction_id: "asc" },
      include: {
        staff: true,
        fromWarehouse: true,
        toWarehouse: true,
        fromVehicle: true,
        toVehicle: true,
        details: true,
      },
    });

    return NextResponse.json(transactions, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch inventory transactions" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      transaction_type,
      movement_type,
      location_type,
      from_location_type,
      to_location_type,
      staff_id,
      product_id,
      quantity,
      from_warehouse_id,
      to_warehouse_id,
      from_vehicle_id,
      to_vehicle_id,
    } = body;

    const normalizedMovement = String(movement_type ?? transaction_type ?? "in").trim().toLowerCase();
    const productId = Number(product_id);
    const staffId = Number(staff_id ?? 1);
    const qty = Number(quantity);

    if (!["in", "out", "transfer"].includes(normalizedMovement)) {
      return NextResponse.json(
        { error: "movement_type must be one of: in, out, transfer" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!Number.isInteger(productId) || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "product_id and quantity are required" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!Number.isInteger(staffId) || staffId <= 0) {
      return NextResponse.json(
        { error: "Valid staff_id is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const normalizedFromLocationType = from_location_type
      ? String(from_location_type).trim().toLowerCase()
      : String(location_type ?? "warehouse").trim().toLowerCase();

    const normalizedToLocationType = to_location_type
      ? String(to_location_type).trim().toLowerCase()
      : String(location_type ?? "warehouse").trim().toLowerCase();

    if (!["warehouse", "vehicle"].includes(normalizedFromLocationType)) {
      return NextResponse.json(
        { error: "from_location_type must be warehouse or vehicle" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!["warehouse", "vehicle"].includes(normalizedToLocationType)) {
      return NextResponse.json(
        { error: "to_location_type must be warehouse or vehicle" },
        { status: 400, headers: corsHeaders },
      );
    }

    let sourceWarehouseId: number | null = null;
    let targetWarehouseId: number | null = null;
    let sourceVehicleId: number | null = null;
    let targetVehicleId: number | null = null;

    if (normalizedMovement === "in") {
      if (normalizedToLocationType === "warehouse") {
        targetWarehouseId = to_warehouse_id === undefined ? null : Number(to_warehouse_id);
        if (targetWarehouseId === null) {
          return NextResponse.json(
            { error: "to_warehouse_id is required for stock-in to warehouse" },
            { status: 400, headers: corsHeaders },
          );
        }
      } else {
        targetVehicleId = to_vehicle_id === undefined ? null : Number(to_vehicle_id);
        if (targetVehicleId === null) {
          return NextResponse.json(
            { error: "to_vehicle_id is required for stock-in to vehicle" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
    } else if (normalizedMovement === "out") {
      if (normalizedFromLocationType === "warehouse") {
        sourceWarehouseId = from_warehouse_id === undefined ? null : Number(from_warehouse_id);
        if (sourceWarehouseId === null) {
          return NextResponse.json(
            { error: "from_warehouse_id is required for stock-out from warehouse" },
            { status: 400, headers: corsHeaders },
          );
        }
      } else {
        sourceVehicleId = from_vehicle_id === undefined ? null : Number(from_vehicle_id);
        if (sourceVehicleId === null) {
          return NextResponse.json(
            { error: "from_vehicle_id is required for stock-out from vehicle" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
    } else if (normalizedMovement === "transfer") {
      if (normalizedFromLocationType === "warehouse") {
        sourceWarehouseId = from_warehouse_id === undefined ? null : Number(from_warehouse_id);
        if (sourceWarehouseId === null) {
          return NextResponse.json(
            { error: "from_warehouse_id is required for transfer source" },
            { status: 400, headers: corsHeaders },
          );
        }
      } else {
        sourceVehicleId = from_vehicle_id === undefined ? null : Number(from_vehicle_id);
        if (sourceVehicleId === null) {
          return NextResponse.json(
            { error: "from_vehicle_id is required for transfer source" },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      if (normalizedToLocationType === "warehouse") {
        targetWarehouseId = to_warehouse_id === undefined ? null : Number(to_warehouse_id);
        if (targetWarehouseId === null) {
          return NextResponse.json(
            { error: "to_warehouse_id is required for transfer destination" },
            { status: 400, headers: corsHeaders },
          );
        }
      } else {
        targetVehicleId = to_vehicle_id === undefined ? null : Number(to_vehicle_id);
        if (targetVehicleId === null) {
          return NextResponse.json(
            { error: "to_vehicle_id is required for transfer destination" },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      if (normalizedFromLocationType === normalizedToLocationType) {
        if (normalizedFromLocationType === "warehouse" && sourceWarehouseId === targetWarehouseId) {
          return NextResponse.json(
            { error: "Source and destination warehouse must be different" },
            { status: 400, headers: corsHeaders },
          );
        }
        if (normalizedFromLocationType === "vehicle" && sourceVehicleId === targetVehicleId) {
          return NextResponse.json(
            { error: "Source and destination vehicle must be different" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const normalizedType = normalizedMovement === "in"
        ? "INBOUND"
        : normalizedMovement === "out"
          ? "OUTBOUND"
          : "TRANSFER";

      const created = await tx.inventoryTransaction.create({
        data: {
          transaction_type: normalizedType,
          staff_id: staffId,
          from_warehouse_id: sourceWarehouseId,
          to_warehouse_id: targetWarehouseId,
          from_vehicle_id: sourceVehicleId,
          to_vehicle_id: targetVehicleId,
        },
      });

      if (normalizedMovement === "in") {
        if (normalizedToLocationType === "warehouse") {
          const existing = await tx.warehouseStock.findUnique({
            where: {
              warehouse_id_product_id: {
                warehouse_id: targetWarehouseId!,
                product_id: productId,
              },
            },
          });

          if (existing) {
            await tx.warehouseStock.update({
              where: {
                warehouse_id_product_id: {
                  warehouse_id: targetWarehouseId!,
                  product_id: productId,
                },
              },
              data: {
                quantity: existing.quantity + qty,
              },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                warehouse_id: targetWarehouseId!,
                product_id: productId,
                quantity: qty,
              },
            });
          }
        } else {
          const existing = await tx.vehicleStock.findUnique({
            where: {
              vehicle_id_product_id: {
                vehicle_id: targetVehicleId!,
                product_id: productId,
              },
            },
          });

          if (existing) {
            await tx.vehicleStock.update({
              where: {
                vehicle_id_product_id: {
                  vehicle_id: targetVehicleId!,
                  product_id: productId,
                },
              },
              data: {
                quantity: existing.quantity + qty,
              },
            });
          } else {
            await tx.vehicleStock.create({
              data: {
                vehicle_id: targetVehicleId!,
                product_id: productId,
                quantity: qty,
              },
            });
          }
        }
      }

      if (normalizedMovement === "out") {
        if (normalizedFromLocationType === "warehouse") {
          const existing = await tx.warehouseStock.findUnique({
            where: {
              warehouse_id_product_id: {
                warehouse_id: sourceWarehouseId!,
                product_id: productId,
              },
            },
          });

          if (!existing || existing.quantity < qty) {
            throw new Error("Insufficient warehouse stock for this product");
          }

          await tx.warehouseStock.update({
            where: {
              warehouse_id_product_id: {
                warehouse_id: sourceWarehouseId!,
                product_id: productId,
              },
            },
            data: {
              quantity: existing.quantity - qty,
            },
          });
        } else {
          const existing = await tx.vehicleStock.findUnique({
            where: {
              vehicle_id_product_id: {
                vehicle_id: sourceVehicleId!,
                product_id: productId,
              },
            },
          });

          if (!existing || existing.quantity < qty) {
            throw new Error("Insufficient vehicle stock for this product");
          }

          await tx.vehicleStock.update({
            where: {
              vehicle_id_product_id: {
                vehicle_id: sourceVehicleId!,
                product_id: productId,
              },
            },
            data: {
              quantity: existing.quantity - qty,
            },
          });
        }
      }

      if (normalizedMovement === "transfer") {
        if (normalizedFromLocationType === "warehouse") {
          const source = await tx.warehouseStock.findUnique({
            where: {
              warehouse_id_product_id: {
                warehouse_id: sourceWarehouseId!,
                product_id: productId,
              },
            },
          });

          if (!source || source.quantity < qty) {
            throw new Error("Insufficient warehouse stock for transfer");
          }

          await tx.warehouseStock.update({
            where: {
              warehouse_id_product_id: {
                warehouse_id: sourceWarehouseId!,
                product_id: productId,
              },
            },
            data: {
              quantity: source.quantity - qty,
            },
          });
        } else {
          const source = await tx.vehicleStock.findUnique({
            where: {
              vehicle_id_product_id: {
                vehicle_id: sourceVehicleId!,
                product_id: productId,
              },
            },
          });

          if (!source || source.quantity < qty) {
            throw new Error("Insufficient vehicle stock for transfer");
          }

          await tx.vehicleStock.update({
            where: {
              vehicle_id_product_id: {
                vehicle_id: sourceVehicleId!,
                product_id: productId,
              },
            },
            data: {
              quantity: source.quantity - qty,
            },
          });
        }

        if (normalizedToLocationType === "warehouse") {
          const destination = await tx.warehouseStock.findUnique({
            where: {
              warehouse_id_product_id: {
                warehouse_id: targetWarehouseId!,
                product_id: productId,
              },
            },
          });

          if (destination) {
            await tx.warehouseStock.update({
              where: {
                warehouse_id_product_id: {
                  warehouse_id: targetWarehouseId!,
                  product_id: productId,
                },
              },
              data: {
                quantity: destination.quantity + qty,
              },
            });
          } else {
            await tx.warehouseStock.create({
              data: {
                warehouse_id: targetWarehouseId!,
                product_id: productId,
                quantity: qty,
              },
            });
          }
        } else {
          const destination = await tx.vehicleStock.findUnique({
            where: {
              vehicle_id_product_id: {
                vehicle_id: targetVehicleId!,
                product_id: productId,
              },
            },
          });

          if (destination) {
            await tx.vehicleStock.update({
              where: {
                vehicle_id_product_id: {
                  vehicle_id: targetVehicleId!,
                  product_id: productId,
                },
              },
              data: {
                quantity: destination.quantity + qty,
              },
            });
          } else {
            await tx.vehicleStock.create({
              data: {
                vehicle_id: targetVehicleId!,
                product_id: productId,
                quantity: qty,
              },
            });
          }
        }
      }

      await tx.transactionDetail.create({
        data: {
          transaction_id: created.transaction_id,
          product_id: productId,
          quantity: qty,
        },
      });

      return created;
    });

    return NextResponse.json(transaction, { status: 201, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create inventory transaction";

    return NextResponse.json(
      { error: message },
      { status: 400, headers: corsHeaders },
    );
  }
}
