"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Product = {
  product_id: number;
  product_name: string;
  category: string;
  cost_price: number;
  retail_price: number;
};

type Staff = {
  staff_id: number;
  staff_name: string;
  username: string;
  role: string;
};

type WarehouseStock = {
  warehouse_id: number;
  product_id: number;
  quantity: number;
  warehouse?: { warehouse_name: string };
  product?: { product_name: string };
};

type SalesOrder = {
  order_id: number;
  total_amount: number;
  salesperson?: { staff_name: string };
};

const quickLinks = [
  { label: "Staff", href: "/staff" },
  { label: "Products", href: "/products" },
  { label: "Warehouses", href: "/warehouses" },
  { label: "Vehicles", href: "/vehicles" },
  { label: "Sales", href: "/sales" },
];

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [stocks, setStocks] = useState<WarehouseStock[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [productResponse, staffResponse, stockResponse, ordersResponse] = await Promise.all([
          fetch("http://localhost:3000/api/products"),
          fetch("http://localhost:3000/api/staff"),
          fetch("http://localhost:3000/api/warehouse-stocks"),
          fetch("http://localhost:3000/api/sales-orders"),
        ]);

        const [productsData, staffData, stockData, ordersData] = await Promise.all([
          productResponse.json(),
          staffResponse.json(),
          stockResponse.json(),
          ordersResponse.json(),
        ]);

        setProducts(Array.isArray(productsData) ? productsData : []);
        setStaff(Array.isArray(staffData) ? staffData : []);
        setStocks(Array.isArray(stockData) ? stockData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const totalInventory = stocks.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const totalSales = orders.reduce((sum, item) => sum + (item.total_amount ?? 0), 0);
  const lowStockCount = stocks.filter((item) => (item.quantity ?? 0) <= 10).length;

  const recentOrders = orders.slice(-3).map((order) => ({
    id: `SO-${order.order_id}`,
    customer: order.salesperson?.staff_name ?? "Unknown",
    total: `$${(order.total_amount ?? 0).toLocaleString()}`,
    status: "Processed",
  }));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-slate-300">
            Loading dashboard data...
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-lg shadow-slate-950/20">
                <p className="text-sm text-slate-400">Total inventory</p>
                <p className="mt-4 text-3xl font-bold text-cyan-300">{totalInventory.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-lg shadow-slate-950/20">
                <p className="text-sm text-slate-400">Sales total</p>
                <p className="mt-4 text-3xl font-bold text-emerald-300">${totalSales.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-lg shadow-slate-950/20">
                <p className="text-sm text-slate-400">Open orders</p>
                <p className="mt-4 text-3xl font-bold text-violet-300">{orders.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-lg shadow-slate-950/20">
                <p className="text-sm text-slate-400">Low stock</p>
                <p className="mt-4 text-3xl font-bold text-amber-300">{lowStockCount}</p>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Recent sales orders</h2>
                  <Link href="/sales" className="text-sm text-cyan-300 transition hover:text-cyan-200">
                    View all
                  </Link>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
                    <thead className="bg-slate-800 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 font-medium">Order</th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Total</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {recentOrders.length > 0 ? (
                        recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td className="px-4 py-3 font-medium text-white">{order.id}</td>
                            <td className="px-4 py-3 text-slate-300">{order.customer}</td>
                            <td className="px-4 py-3 text-slate-300">{order.total}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                            No sales orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                <h2 className="text-xl font-semibold">Operational summary</h2>
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                    <p className="text-sm font-medium text-cyan-300">Products</p>
                    <p className="mt-1 text-sm text-slate-200">{products.length} tracked products</p>
                  </div>
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                    <p className="text-sm font-medium text-violet-300">Staff</p>
                    <p className="mt-1 text-sm text-slate-200">{staff.length} active team members</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm font-medium text-amber-300">Stock alerts</p>
                    <p className="mt-1 text-sm text-slate-200">{lowStockCount} entries below the threshold</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
