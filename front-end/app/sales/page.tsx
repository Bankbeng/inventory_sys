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
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Revenue</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Sales orders</h1>
          </div>
          <button className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500">
            Create sale
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            Loading sales orders...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Salesperson</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sales.length > 0 ? (
                  sales.map((item) => (
                    <tr key={item.order_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">SO-{item.order_id}</td>
                      <td className="px-4 py-3 text-slate-600">{item.salesperson?.staff_name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-cyan-700">${Number(item.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(item.order_date).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
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
