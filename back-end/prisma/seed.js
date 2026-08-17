require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function main() {
  await prisma.staff.createMany({
    data: [
      {
        staff_name: "Admin User",
        username: "admin",
        password: "123456",
        role: "admin",
      },
      {
        staff_name: "Alice Lee",
        username: "alice",
        password: "123456",
        role: "manager",
      },
      {
        staff_name: "Bob Tan",
        username: "bob",
        password: "123456",
        role: "sales",
      },
    ],
    skipDuplicates: true,
  });

  await prisma.product.createMany({
    data: [
      {
        product_name: "Rice Bag 25kg",
        category: "Staples",
        cost_price: 28,
        retail_price: 35,
      },
      {
        product_name: "Cooking Oil 5L",
        category: "Groceries",
        cost_price: 12,
        retail_price: 18.5,
      },
      {
        product_name: "Soap Pack",
        category: "Household",
        cost_price: 8,
        retail_price: 12.25,
      },
    ],
  });

  await prisma.warehouse.createMany({
    data: [
      { warehouse_name: "Central Warehouse" },
      { warehouse_name: "North Hub" },
      { warehouse_name: "Coastal Storage" },
    ],
  });

  await prisma.vehicle.createMany({
    data: [
      { vehicle_name: "Truck 01" },
      { vehicle_name: "Van 07" },
      { vehicle_name: "Truck 12" },
    ],
  });

  console.log("Seed data inserted successfully");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
