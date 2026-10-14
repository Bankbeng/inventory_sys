"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import BrandMark from "../components/BrandMark";

type Product = {
  product_id: number;
  product_name: string;
  retail_price: number;
};

type Staff = {
  staff_id: number;
  staff_name: string;
};

type Warehouse = {
  warehouse_id: number;
  warehouse_name: string;
};

type Vehicle = {
  vehicle_id: number;
  vehicle_name: string;
};

type OrderDetail = {
  product_id: number;
  quantity_sold: number;
  sold_at_price: number;
  product?: { product_name: string };
};

type SalesOrder = {
  order_id: number;
  customer_name?: string;
  total_amount: number;
  is_paid: boolean;
  order_date: string;
  salesperson?: { staff_name: string };
  sourceWarehouse?: { warehouse_name: string };
  sourceVehicle?: { vehicle_name: string };
  details?: OrderDetail[];
};

type SaleLine = {
  productId: string;
  quantity: string;
  price: string;
};

type SaleForm = {
  customerName: string;
  salespersonId: string;
  paymentStatus: "paid" | "unpaid";
  sourceType: "warehouse" | "vehicle";
  sourceId: string;
  lines: SaleLine[];
};

const buildEmptyLine = (): SaleLine => ({
  productId: "",
  quantity: "1",
  price: "0",
});

const initialForm: SaleForm = {
  customerName: "",
  salespersonId: "",
  paymentStatus: "paid",
  sourceType: "warehouse",
  sourceId: "",
  lines: [buildEmptyLine()],
};

export default function SalesPage() {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState<SaleForm>(initialForm);

  async function loadSalesData() {
    try {
      const [salesResponse, productResponse, staffResponse, warehouseResponse, vehicleResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sales-orders`),
        fetch(`${API_BASE_URL}/api/products`),
        fetch(`${API_BASE_URL}/api/staff`),
        fetch(`${API_BASE_URL}/api/warehouses`),
        fetch(`${API_BASE_URL}/api/vehicles`),
      ]);

      const [salesData, productData, staffData, warehouseData, vehicleData] = await Promise.all([
        salesResponse.json(),
        productResponse.json(),
        staffResponse.json(),
        warehouseResponse.json(),
        vehicleResponse.json(),
      ]);

      const nextSales = Array.isArray(salesData) ? salesData : [];
      const nextProducts = Array.isArray(productData) ? productData : [];
      const nextStaff = Array.isArray(staffData) ? staffData : [];
      const nextWarehouses = Array.isArray(warehouseData) ? warehouseData : [];
      const nextVehicles = Array.isArray(vehicleData) ? vehicleData : [];

      setSales(nextSales);
      setProducts(nextProducts);
      setStaff(nextStaff);
      setWarehouses(nextWarehouses);
      setVehicles(nextVehicles);

      if (!form.salespersonId && nextStaff[0]) {
        setForm((current) => ({ ...current, salespersonId: String(nextStaff[0].staff_id) }));
      }

      if (nextProducts[0]) {
        setForm((current) => ({
          ...current,
          lines: current.lines.map((line, index) =>
            index === 0 ? { ...line, productId: String(nextProducts[0].product_id), price: String(nextProducts[0].retail_price) } : line,
          ),
        }));
      }

      if (!form.sourceId && nextWarehouses[0]) {
        setForm((current) => ({ ...current, sourceId: String(nextWarehouses[0].warehouse_id) }));
      }
    } catch (error) {
      console.error("Failed to load sales data", error);
      setMessage("Failed to load sales data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalesData();
  }, []);

  const sourceOptions = form.sourceType === "warehouse" ? warehouses : vehicles;

  const totalValue = useMemo(
    () =>
      form.lines.reduce((sum, line) => {
        const quantity = Number(line.quantity) || 0;
        const price = Number(line.price) || 0;
        return sum + quantity * price;
      }, 0),
    [form.lines],
  );

  const addLine = () => {
    const nextProduct = products[0];
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          productId: nextProduct ? String(nextProduct.product_id) : "",
          quantity: "1",
          price: nextProduct ? String(nextProduct.retail_price) : "0",
        },
      ],
    }));
  };

  const updateLine = (index: number, field: keyof SaleLine, value: string) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    }));
  };

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validLines = form.lines.filter((line) => {
      const productId = Number(line.productId);
      const quantity = Number(line.quantity);
      const price = Number(line.price);
      return Number.isInteger(productId) && productId > 0 && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price) && price >= 0;
    });

    if (!form.customerName.trim()) {
      setMessage("Please enter the customer name.");
      return;
    }

    if (!form.salespersonId) {
      setMessage("Please select a salesperson.");
      return;
    }

    if (!form.sourceId) {
      setMessage("Please select a source warehouse or vehicle.");
      return;
    }

    if (validLines.length === 0) {
      setMessage("Please add at least one valid product item.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        customer_name: form.customerName.trim(),
        salesperson_id: Number(form.salespersonId),
        is_paid: form.paymentStatus === "paid",
        ...(form.sourceType === "warehouse"
          ? { source_warehouse_id: Number(form.sourceId) }
          : { source_vehicle_id: Number(form.sourceId) }),
        total_amount: totalValue,
        items: validLines.map((line) => ({
          product_id: Number(line.productId),
          quantity_sold: Number(line.quantity),
          sold_at_price: Number(line.price),
        })),
      };

      const response = await fetch(`${API_BASE_URL}/api/sales-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sale creation failed");
      }

      setForm({
        customerName: "",
        salespersonId: form.salespersonId,
        paymentStatus: "paid",
        sourceType: "warehouse",
        sourceId: warehouses[0] ? String(warehouses[0].warehouse_id) : "",
        lines: [buildEmptyLine()],
      });
      await loadSalesData();
      setMessage("Sale recorded successfully.");
    } catch (error) {
      console.error("Sale creation failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to record sale.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Revenue</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Sales orders</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-2 block">Customer name</span>
              <input
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                placeholder="John Doe"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Salesperson</span>
              <select
                value={form.salespersonId}
                onChange={(event) => setForm((current) => ({ ...current, salespersonId: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
              >
                <option value="">Select salesperson</option>
                {staff.map((member) => (
                  <option key={member.staff_id} value={member.staff_id}>
                    {member.staff_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Payment status</span>
              <select
                value={form.paymentStatus}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  paymentStatus: event.target.value as SaleForm["paymentStatus"],
                }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid (add to receivables)</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Source type</span>
              <select
                value={form.sourceType}
                onChange={(event) => {
                  const nextType = event.target.value as "warehouse" | "vehicle";
                  const nextSourceId =
                    nextType === "warehouse"
                      ? warehouses[0]?.warehouse_id ?? ""
                      : vehicles[0]?.vehicle_id ?? "";

                  setForm((current) => ({
                    ...current,
                    sourceType: nextType,
                    sourceId: String(nextSourceId),
                  }));
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
              >
                <option value="warehouse">Warehouse</option>
                <option value="vehicle">Vehicle</option>
              </select>
            </label>

            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-2 block">Source</span>
              <select
                value={form.sourceId}
                onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
              >
                <option value="">Select source</option>
                {sourceOptions.map((location) => (
                  <option
                    key={form.sourceType === "warehouse" ? (location as Warehouse).warehouse_id : (location as Vehicle).vehicle_id}
                    value={String(form.sourceType === "warehouse" ? (location as Warehouse).warehouse_id : (location as Vehicle).vehicle_id)}
                  >
                    {form.sourceType === "warehouse" ? (location as Warehouse).warehouse_name : (location as Vehicle).vehicle_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 space-y-4">
            {form.lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.5fr_0.8fr_0.9fr_auto]">
                <label className="text-sm text-slate-700">
                  <span className="mb-2 block">Product</span>
                  <select
                    value={line.productId}
                    onChange={(event) => {
                      const productId = event.target.value;
                      const selectedProduct = products.find(
                        (product) => String(product.product_id) === productId,
                      );

                      setForm((current) => ({
                        ...current,
                        lines: current.lines.map((currentLine, lineIndex) =>
                          lineIndex === index
                            ? {
                                ...currentLine,
                                productId,
                                price: selectedProduct ? String(selectedProduct.retail_price) : "0",
                              }
                            : currentLine,
                        ),
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.product_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-slate-700">
                  <span className="mb-2 block">Quantity</span>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, "quantity", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  <span className="mb-2 block">Unit price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.price}
                    onChange={(event) => updateLine(index, "price", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={form.lines.length === 1}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={addLine}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Add item
            </button>

            <div className="text-right">
              <p className="text-sm text-slate-500">Order total</p>
              <p className="text-2xl font-bold text-cyan-700">{formatCurrency(totalValue)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Recording sale..." : "Create sale"}
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-cyan-700">{message}</p>}
        </form>

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
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Salesperson</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sales.length > 0 ? (
                  sales.map((item) => {
                    const sourceName = item.sourceWarehouse?.warehouse_name ?? item.sourceVehicle?.vehicle_name ?? "Unknown";
                    const itemSummary = item.details
                      ?.map((detail) => `${detail.product?.product_name ?? `Product ${detail.product_id}`} (${detail.quantity_sold})`)
                      .join(", ") ?? "No items";

                    return (
                      <tr key={item.order_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">SO-{item.order_id}</td>
                        <td className="px-4 py-3 text-slate-600">{item.customer_name ?? "Walk-in Customer"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.salesperson?.staff_name ?? "Unknown"}</td>
                        <td className="px-4 py-3 text-slate-600">{sourceName}</td>
                        <td className="px-4 py-3 text-slate-600">{itemSummary}</td>
                        <td className="px-4 py-3 text-cyan-700">{formatCurrency(Number(item.total_amount || 0))}</td>
                        <td className="px-4 py-3 text-slate-600">{new Date(item.order_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={item.is_paid
                            ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"}
                          >
                            {item.is_paid ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setReceiptOrder(item)}
                            className="font-medium text-cyan-700 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-900"
                          >
                            Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      No sales orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiptOrder && (
        <div className="receipt-overlay" role="presentation" onClick={() => setReceiptOrder(null)}>
          <div
            className="receipt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="receipt-toolbar">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
              >
                Print receipt
              </button>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <article className="receipt-paper">
              <header className="receipt-header">
                <BrandMark />
                <p className="receipt-subtitle">Sales receipt</p>
              </header>

              <div className="receipt-order-details">
                <div>
                  <h2 id="receipt-title">Order SO-{receiptOrder.order_id}</h2>
                  <p>{new Date(receiptOrder.order_date).toLocaleString()}</p>
                </div>
                <div className="receipt-customer">
                  <span>Customer</span>
                  <strong>{receiptOrder.customer_name ?? "Walk-in Customer"}</strong>
                </div>
              </div>

              <dl className="receipt-meta">
                <div>
                  <dt>Salesperson</dt>
                  <dd>{receiptOrder.salesperson?.staff_name ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{receiptOrder.sourceWarehouse?.warehouse_name ?? receiptOrder.sourceVehicle?.vehicle_name ?? "Unknown"}</dd>
                </div>
              </dl>

              <table className="receipt-items">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptOrder.details?.map((detail) => (
                    <tr key={`${receiptOrder.order_id}-${detail.product_id}`}>
                      <td>{detail.product?.product_name ?? `Product ${detail.product_id}`}</td>
                      <td>{detail.quantity_sold}</td>
                      <td>{formatCurrency(Number(detail.sold_at_price))}</td>
                      <td>{formatCurrency(Number(detail.quantity_sold) * Number(detail.sold_at_price))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Total</th>
                    <th>{formatCurrency(Number(receiptOrder.total_amount || 0))}</th>
                  </tr>
                </tfoot>
              </table>

              <p className="receipt-thanks">Thank you for your purchase.</p>
            </article>
          </div>
        </div>
      )}
    </main>
  );
}
