"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import SearchableSelect from "../components/SearchableSelect";

type Product = {
  product_id: number;
  product_name: string;
  type: string;
  size: string;
  unit: string;
  retail_price: number;
};

type Customer = {
  customer_id: number;
  customer_name: string;
  phone_number?: string | null;
};

type Warehouse = {
  warehouse_id: number;
  warehouse_name: string;
};

type Vehicle = {
  vehicle_id: number;
  vehicle_name: string;
};

type ProductStock = {
  product_id: number;
  quantity: number;
  warehouse_id?: number;
  vehicle_id?: number;
};

type SaleDetail = {
  product_id: number;
  quantity_sold: number;
  sold_at_price: number;
  product?: Product;
};

type SalesOrder = {
  order_id: number;
  customer_id: number | null;
  customer_name: string;
  discount_amount: number;
  total_amount: number;
  is_paid: boolean;
  order_date: string;
  source_warehouse_id: number | null;
  source_vehicle_id: number | null;
  salesperson?: { staff_name: string };
  sourceWarehouse?: Warehouse | null;
  sourceVehicle?: Vehicle | null;
  details: SaleDetail[];
};

type SaleLine = {
  productId: string;
  quantity: string;
  price: string;
};

type SaleForm = {
  customerId: string;
  sourceType: "warehouse" | "vehicle";
  sourceId: string;
  discountAmount: string;
  lines: SaleLine[];
};

const emptyLine = (): SaleLine => ({ productId: "", quantity: "1", price: "0" });

function getProductLabel(product: Pick<Product, "product_name" | "type" | "size" | "unit">) {
  const attributes = [product.type, [product.size, product.unit].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return attributes ? `${product.product_name} (${attributes})` : product.product_name;
}

export default function SalesManagementPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<ProductStock[]>([]);
  const [vehicleStocks, setVehicleStocks] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [form, setForm] = useState<SaleForm>({
    customerId: "",
    sourceType: "warehouse",
    sourceId: "",
    discountAmount: "0",
    lines: [emptyLine()],
  });
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all([
        fetch(`${API_BASE_URL}/api/sales-orders`),
        fetch(`${API_BASE_URL}/api/products`),
        fetch(`${API_BASE_URL}/api/customers`),
        fetch(`${API_BASE_URL}/api/warehouses`),
        fetch(`${API_BASE_URL}/api/vehicles`),
        fetch(`${API_BASE_URL}/api/warehouse-stocks`),
        fetch(`${API_BASE_URL}/api/vehicle-stocks`),
      ]);
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        const data = await failedResponse.json().catch(() => null);
        throw new Error(data?.error || "Failed to load sales order management data.");
      }

      const [
        orderData,
        productData,
        customerData,
        warehouseData,
        vehicleData,
        warehouseStockData,
        vehicleStockData,
      ] = await Promise.all(responses.map((response) => response.json()));

      setOrders(Array.isArray(orderData) ? orderData : []);
      setProducts(Array.isArray(productData) ? productData : []);
      setCustomers(Array.isArray(customerData) ? customerData : []);
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : []);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setWarehouseStocks(Array.isArray(warehouseStockData) ? warehouseStockData : []);
      setVehicleStocks(Array.isArray(vehicleStockData) ? vehicleStockData : []);
    } catch (loadError) {
      console.error("Failed to load sales order management data", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load sales orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const customerOptions = useMemo(
    () => customers.map((customer) => ({
      value: String(customer.customer_id),
      label: customer.customer_name,
      searchText: customer.phone_number ?? "",
    })),
    [customers],
  );
  const productOptions = useMemo(
    () => products.map((product) => ({
      value: String(product.product_id),
      label: getProductLabel(product),
    })),
    [products],
  );
  const sourceOptions = form.sourceType === "warehouse" ? warehouses : vehicles;
  const subtotal = form.lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0),
    0,
  );
  const discountValue = Number(form.discountAmount);
  const total = Math.max(
    0,
    subtotal - (Number.isFinite(discountValue) ? discountValue : 0),
  );
  const filteredOrders = orders.filter((order) => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return true;
    return [
      String(order.order_id),
      order.customer_name,
      order.salesperson?.staff_name ?? "",
      order.sourceWarehouse?.warehouse_name ?? order.sourceVehicle?.vehicle_name ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(query));
  });

  function startEditing(order: SalesOrder) {
    setEditingOrderId(order.order_id);
    setForm({
      customerId: order.customer_id ? String(order.customer_id) : "",
      sourceType: order.source_vehicle_id !== null ? "vehicle" : "warehouse",
      sourceId: String(order.source_vehicle_id ?? order.source_warehouse_id ?? ""),
      discountAmount: String(order.discount_amount ?? 0),
      lines: order.details.map((detail) => ({
        productId: String(detail.product_id),
        quantity: String(detail.quantity_sold),
        price: String(detail.sold_at_price),
      })),
    });
    setMessage(null);
    setError(null);
    document.getElementById("order-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditing() {
    setEditingOrderId(null);
    setForm({
      customerId: "",
      sourceType: "warehouse",
      sourceId: "",
      discountAmount: "0",
      lines: [emptyLine()],
    });
    setMessage(null);
  }

  function updateLine(index: number, field: keyof SaleLine, value: string) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    }));
  }

  async function saveOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const orderId = editingOrderId;
    if (orderId === null) return;

    if (!form.customerId || !form.sourceId) {
      setError("Select a customer and source location.");
      return;
    }
    if (form.lines.length === 0 || form.lines.some((line) => {
      const productId = Number(line.productId);
      const quantity = Number(line.quantity);
      const price = Number(line.price);
      return !Number.isInteger(productId) || productId <= 0 ||
        !Number.isInteger(quantity) || quantity <= 0 ||
        !Number.isFinite(price) || price < 0;
    })) {
      setError("Each item needs a product, a positive whole-number quantity, and a valid price.");
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > subtotal) {
      setError("Discount must be between 0 and the item subtotal.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: Number(form.customerId),
          source_warehouse_id: form.sourceType === "warehouse" ? Number(form.sourceId) : null,
          source_vehicle_id: form.sourceType === "vehicle" ? Number(form.sourceId) : null,
          discount_amount: discountValue,
          total_amount: total,
          items: form.lines.map((line) => ({
            product_id: Number(line.productId),
            quantity_sold: Number(line.quantity),
            sold_at_price: Number(line.price),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update sales order.");
      }
      cancelEditing();
      await loadData();
      setMessage(`Order SO-${orderId} updated successfully.`);
    } catch (saveError) {
      console.error("Failed to update sales order", saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to update sales order.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(order: SalesOrder) {
    if (!window.confirm(
      `Delete order SO-${order.order_id}? Its items will be returned to stock and its payment history will be removed.`,
    )) {
      return;
    }

    setDeletingOrderId(order.order_id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-orders/${order.order_id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete sales order.");
      }
      if (editingOrderId === order.order_id) {
        cancelEditing();
      }
      await loadData();
      setMessage(`Order SO-${order.order_id} deleted and stock returned.`);
    } catch (deleteError) {
      console.error("Failed to delete sales order", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete sales order.");
    } finally {
      setDeletingOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Administration</p>
          <h1 className="mt-2 text-3xl font-bold">Sales order management</h1>
          <p className="mt-2 text-sm text-slate-600">Edit or delete orders. Changes to items and source locations update stock.</p>
        </header>

        {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        {editingOrderId !== null && (
          <form
            id="order-editor"
            onSubmit={saveOrder}
            className="mb-6 scroll-mt-24 rounded-2xl border border-cyan-200 bg-cyan-50/40 p-5 shadow-sm"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Edit order SO-{editingOrderId}</h2>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect
                label="Customer"
                options={customerOptions}
                value={form.customerId}
                onChange={(customerId) => setForm((current) => ({ ...current, customerId }))}
                placeholder="Search customer"
              />
              <label className="text-sm text-slate-700">
                <span className="mb-2 block">Stock source type</span>
                <select
                  value={form.sourceType}
                  onChange={(event) => {
                    const sourceType = event.target.value as SaleForm["sourceType"];
                    const locations = sourceType === "warehouse" ? warehouses : vehicles;
                    setForm((current) => ({
                      ...current,
                      sourceType,
                      sourceId: locations[0]
                        ? String(sourceType === "warehouse"
                          ? (locations[0] as Warehouse).warehouse_id
                          : (locations[0] as Vehicle).vehicle_id)
                        : "",
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="vehicle">Vehicle</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-2 block">Source</span>
                <select
                  value={form.sourceId}
                  onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="">Select source</option>
                  {sourceOptions.map((location) => {
                    const id = form.sourceType === "warehouse"
                      ? (location as Warehouse).warehouse_id
                      : (location as Vehicle).vehicle_id;
                    const name = form.sourceType === "warehouse"
                      ? (location as Warehouse).warehouse_name
                      : (location as Vehicle).vehicle_name;
                    return <option key={id} value={String(id)}>{name}</option>;
                  })}
                </select>
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {form.lines.map((line, index) => {
                const selectedProduct = products.find((product) => String(product.product_id) === line.productId);
                const stockRows = form.sourceType === "warehouse" ? warehouseStocks : vehicleStocks;
                const stockQuantity = line.productId && form.sourceId
                  ? stockRows.find((stock) =>
                      String(stock.product_id) === line.productId &&
                      String(form.sourceType === "warehouse" ? stock.warehouse_id : stock.vehicle_id) === form.sourceId,
                    )?.quantity ?? 0
                  : null;
                const editedOrder = orders.find((order) => order.order_id === editingOrderId);
                const originalQuantity = editedOrder && line.productId &&
                  ((form.sourceType === "warehouse" && String(editedOrder.source_warehouse_id) === form.sourceId) ||
                    (form.sourceType === "vehicle" && String(editedOrder.source_vehicle_id) === form.sourceId))
                  ? editedOrder.details
                      .filter((detail) => String(detail.product_id) === line.productId)
                      .reduce((sum, detail) => sum + detail.quantity_sold, 0)
                  : 0;
                const available = stockQuantity === null ? null : stockQuantity + originalQuantity;
                const requested = line.productId
                  ? form.lines
                      .filter((item) => item.productId === line.productId)
                      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
                  : 0;

                return (
                  <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1.5fr_0.7fr_0.8fr_auto]">
                    <div>
                      <SearchableSelect
                        label="Product"
                        options={productOptions}
                        value={line.productId}
                        onChange={(productId) => {
                          const product = products.find((item) => String(item.product_id) === productId);
                          setForm((current) => ({
                            ...current,
                            lines: current.lines.map((item, lineIndex) =>
                              lineIndex === index
                                ? { ...item, productId, price: product ? String(product.retail_price) : "0" }
                                : item,
                            ),
                          }));
                        }}
                        placeholder="Search product"
                      />
                      {selectedProduct && (
                        <p className={`mt-1 text-xs ${available !== null && requested > available ? "text-rose-700" : "text-slate-500"}`}>
                          {available === null
                            ? "Select a source to see stock."
                            : `Available: ${available} ${selectedProduct.unit || "units"} · Remaining: ${available - requested}`}
                        </p>
                      )}
                    </div>
                    <label className="text-sm text-slate-700">
                      <span className="mb-2 block">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, "quantity", event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
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
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({
                          ...current,
                          lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
                        }))}
                        disabled={form.lines.length === 1}
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setForm((current) => ({
                  ...current,
                  lines: [...current.lines, emptyLine()],
                }))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-100"
              >
                Add item
              </button>
              <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto] sm:items-end">
                <label className="text-sm text-slate-700">
                  <span className="mb-2 block">Discount amount</span>
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    value={form.discountAmount}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      discountAmount: event.target.value,
                    }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Subtotal: {formatCurrency(subtotal)}</p>
                  <p className="text-sm text-slate-500">Discount: {formatCurrency(Number.isFinite(discountValue) ? discountValue : 0)}</p>
                  <p className="text-lg font-bold text-cyan-700">Order total: {formatCurrency(total)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 p-4">
            <div>
              <h2 className="text-lg font-semibold">Sales orders</h2>
              <p className="text-sm text-slate-500">{filteredOrders.length} order(s)</p>
            </div>
            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Search orders</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order, customer, salesperson, source"
                className="w-72 max-w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </label>
          </div>

          {loading ? (
            <div role="status" className="border-t border-slate-200 p-6 text-slate-600">Loading orders...</div>
          ) : (
            <div className="overflow-x-auto">
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
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                    <tr key={order.order_id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">SO-{order.order_id}</td>
                      <td className="px-4 py-3">{order.customer_name || "Walk-in Customer"}</td>
                      <td className="px-4 py-3">{order.salesperson?.staff_name ?? "Unknown"}</td>
                      <td className="px-4 py-3">{order.sourceWarehouse?.warehouse_name ?? order.sourceVehicle?.vehicle_name ?? "Unknown"}</td>
                      <td className="min-w-52 px-4 py-3">
                        {order.details.map((detail) =>
                          `${detail.product ? getProductLabel(detail.product) : `Product ${detail.product_id}`} (${detail.quantity_sold})`,
                        ).join(", ")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-cyan-700">{formatCurrency(Number(order.total_amount || 0))}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(order.order_date)}</td>
                      <td className="px-4 py-3">
                        <span className={order.is_paid
                          ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"}
                        >
                          {order.is_paid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEditing(order)}
                            disabled={saving || deletingOrderId !== null}
                            className="font-medium text-cyan-700 underline underline-offset-4 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteOrder(order)}
                            disabled={saving || deletingOrderId !== null}
                            className="font-medium text-rose-700 underline underline-offset-4 disabled:opacity-50"
                          >
                            {deletingOrderId === order.order_id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                        {search ? "No matching orders." : "No sales orders found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
