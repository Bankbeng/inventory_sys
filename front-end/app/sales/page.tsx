"use client";

import { useEffect, useState } from "react";

type SalesOrder = {
  order_id: number;
  total_amount: number;
  order_date: string;
  salesperson?: { staff_name: string };
};

export default function SalesPage() {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSales() {
      try {
        const response = await fetch("http://localhost:3000/api/sales-orders");
        const data = await response.json();
        setSales(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load sales orders", error);
      } finally {
        setLoading(false);
      }
    }

    loadSales();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Revenue</p>
            <h1 className="mt-2 text-3xl font-bold">Sales orders</h1>
          </div>
          <button className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Create sale
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
            Loading sales orders...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Salesperson</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sales.length > 0 ? (
                  sales.map((item) => (
                    <tr key={item.order_id} className="hover:bg-slate-800/80">
                      <td className="px-4 py-3 font-medium text-white">SO-{item.order_id}</td>
                      <td className="px-4 py-3 text-slate-300">{item.salesperson?.staff_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-cyan-300">${Number(item.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-300">{new Date(item.order_date).toLocaleDateString()}</td>
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
        )}
      </div>
    </main>
  );
}
