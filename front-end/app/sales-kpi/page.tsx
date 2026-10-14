"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";

type SalesOrder = {
  total_amount: number;
  order_date: string;
  salesperson?: { staff_id: number; staff_name: string };
};

type RankedSalesperson = { staffId: number; name: string; total: number };
type SalesPeriod = "all" | "range";

function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SalesKpiPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function loadSalesOrders() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/sales-orders`);
        if (!response.ok) throw new Error("Sales orders request failed.");

        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (loadError) {
        console.error("Failed to load sales KPI data", loadError);
        setError("Sales data could not be loaded. Check the API connection and try again.");
      } finally {
        setLoading(false);
      }
    }

    loadSalesOrders();
  }, []);

  const periodOrders = orders.filter((order) => {
    if (salesPeriod === "all") return true;
    if (!startDate || !endDate || startDate > endDate) return false;

    const orderDate = localDateKey(order.order_date);
    return orderDate >= startDate && orderDate <= endDate;
  });

  const salespersonTotals = new Map<number, RankedSalesperson>();
  for (const order of periodOrders) {
    if (!order.salesperson) continue;

    const { staff_id: staffId, staff_name: name } = order.salesperson;
    const existing = salespersonTotals.get(staffId);
    salespersonTotals.set(staffId, {
      staffId,
      name,
      total: (existing?.total ?? 0) + (order.total_amount ?? 0),
    });
  }

  const rankedSalespeople = [...salespersonTotals.values()].sort(
    (first, second) => second.total - first.total || first.name.localeCompare(second.name),
  );

  return (
    <main className="min-h-screen bg-[#f4f6f3] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">Performance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sales KPI</h1>
          </div>
          <p className="text-sm text-slate-500">Sales ranked by salesperson</p>
        </header>

        {loading ? (
          <div className="border-y border-slate-300 py-8 text-sm text-slate-600" role="status">
            Loading sales data...
          </div>
        ) : error ? (
          <div className="border-y border-rose-300 py-6 text-sm text-rose-800" role="alert">
            {error}
          </div>
        ) : (
          <section aria-labelledby="sales-rank-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <h2 id="sales-rank-heading" className="text-xl font-semibold text-slate-950">Sales by salesperson</h2>
              <div className="flex flex-wrap items-end gap-3">
                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium text-slate-500">Period</legend>
                  <div className="inline-flex rounded-md border border-slate-300 p-0.5" aria-label="Sales ranking period">
                    {(["all", "range"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={salesPeriod === period}
                        onClick={() => setSalesPeriod(period)}
                        className={[
                          "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                          salesPeriod === period
                            ? "bg-teal-800 text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        ].join(" ")}
                      >
                        {period === "all" ? "All time" : "Date range"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {salesPeriod === "range" && (
                  <label className="grid gap-1 text-xs font-medium text-slate-500">
                    Start date
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                    />
                  </label>
                )}
                {salesPeriod === "range" && (
                  <label className="grid gap-1 text-xs font-medium text-slate-500">
                    End date
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="overflow-x-auto border-y border-slate-300">
              <table className="w-full min-w-105 text-left text-sm">
                <thead className="border-b border-slate-300 text-xs text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="w-20 py-3 pr-4 font-medium">Rank</th>
                    <th scope="col" className="py-3 pr-4 font-medium">Salesperson</th>
                    <th scope="col" className="py-3 text-right font-medium">Sales total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rankedSalespeople.length > 0 ? rankedSalespeople.map((person, index) => (
                    <tr key={person.staffId}>
                      <td className="py-3.5 pr-4 font-mono text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                      <td className="py-3.5 pr-4 font-medium text-slate-800">{person.name}</td>
                      <td className="py-3.5 text-right font-medium tabular-nums text-slate-950">{formatCurrency(person.total)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-500">
                        {salesPeriod === "all"
                          ? "No salesperson sales recorded."
                          : !startDate || !endDate
                            ? "Select both a start date and an end date."
                            : startDate > endDate
                              ? "Start date must be on or before end date."
                              : "No sales found for this period."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}