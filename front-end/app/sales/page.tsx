"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import BrandMark from "../components/BrandMark";
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
  place_link?: string | null;
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
  product?: Pick<Product, "product_id" | "product_name" | "type" | "size" | "unit">;
};

type SalesOrder = {
  order_id: number;
  customer_name?: string;
  customer?: Pick<Customer, "customer_name" | "phone_number" | "place_link"> | null;
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
  customerId: string;
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
  customerId: "",
  paymentStatus: "paid",
  sourceType: "warehouse",
  sourceId: "",
  lines: [buildEmptyLine()],
};

function getProductLabel(product: Pick<Product, "product_name" | "type" | "size" | "unit">) {
  const attributes = [product.type, [product.size, product.unit].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return attributes ? `${product.product_name} (${attributes})` : product.product_name;
}

function getInvoiceNumber(order: Pick<SalesOrder, "order_id" | "order_date">) {
  const year = new Date(order.order_date).getFullYear().toString().slice(-2);
  return `IV${year}-${String(order.order_id).padStart(5, "0")}`;
}

function getDueDate(orderDate: string) {
  const dueDate = new Date(orderDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return formatDate(dueDate);
}

export default function SalesPage() {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState<SaleForm>(initialForm);

  const loadSalesData = useCallback(async () => {
    try {
      const [salesResponse, productResponse, warehouseResponse, vehicleResponse, customerResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/sales-orders`),
        fetch(`${API_BASE_URL}/api/products`),
        fetch(`${API_BASE_URL}/api/warehouses`),
        fetch(`${API_BASE_URL}/api/vehicles`),
        fetch(`${API_BASE_URL}/api/customers`),
      ]);

      if (!customerResponse.ok) {
        throw new Error("Failed to load customer records.");
      }

      const [salesData, productData, warehouseData, vehicleData, customerData] = await Promise.all([
        salesResponse.json(),
        productResponse.json(),
        warehouseResponse.json(),
        vehicleResponse.json(),
        customerResponse.json(),
      ]);

      const nextSales = Array.isArray(salesData) ? salesData : [];
      const nextProducts = Array.isArray(productData) ? productData : [];
      const nextWarehouses = Array.isArray(warehouseData) ? warehouseData : [];
      const nextVehicles = Array.isArray(vehicleData) ? vehicleData : [];
      const nextCustomers = Array.isArray(customerData) ? customerData : [];

      setSales(nextSales);
      setProducts(nextProducts);
      setWarehouses(nextWarehouses);
      setVehicles(nextVehicles);
      setCustomers(nextCustomers);

      if (nextProducts[0]) {
        setForm((current) => ({
          ...current,
          lines: current.lines.map((line, index) =>
            index === 0 ? { ...line, productId: String(nextProducts[0].product_id), price: String(nextProducts[0].retail_price) } : line,
          ),
        }));
      }

      if (nextWarehouses[0]) {
        setForm((current) =>
          current.sourceId
            ? current
            : { ...current, sourceId: String(nextWarehouses[0].warehouse_id) },
        );
      }
    } catch (error) {
      console.error("Failed to load sales data", error);
      setMessage("Failed to load sales data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadSalesData);
  }, [loadSalesData]);

  const sourceOptions = form.sourceType === "warehouse" ? warehouses : vehicles;
  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.customer_id),
        label: customer.customer_name,
        searchText: customer.phone_number ?? "",
      })),
    [customers],
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product.product_id),
        label: getProductLabel(product),
      })),
    [products],
  );

  const totalValue = useMemo(
    () =>
      form.lines.reduce((sum, line) => {
        const quantity = Number(line.quantity) || 0;
        const price = Number(line.price) || 0;
        return sum + quantity * price;
      }, 0),
    [form.lines],
  );

  const invoiceDetails = invoiceOrder?.details ?? [];
  const invoiceSubtotal = invoiceDetails.reduce(
    (sum, detail) => sum + Number(detail.quantity_sold) * Number(detail.sold_at_price),
    0,
  );
  const invoiceQuantity = invoiceDetails.reduce((sum, detail) => sum + Number(detail.quantity_sold), 0);

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

    if (!form.customerId) {
      setMessage("Please select a customer.");
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
        customer_id: Number(form.customerId),
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
        customerId: "",
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
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Sales orders</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm text-slate-700 md:col-span-2">
              <SearchableSelect
                label="ລູກຄ້າ"
                options={customerOptions}
                value={form.customerId}
                onChange={(customerId) => setForm((current) => ({ ...current, customerId }))}
                placeholder="ຄົ້ນຫາລູກຄ້າຕາມຊື່ ຫຼື ເບີໂທ"
              />
              {customers.length === 0 && (
                <span className="mt-1 block text-xs text-slate-500">
                  No customers yet. <a href="/customers" className="text-cyan-700 underline">Add a customer</a>.
                </span>
              )}
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">ການຊຳລະ</span>
              <select
                value={form.paymentStatus}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  paymentStatus: event.target.value as SaleForm["paymentStatus"],
                }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
              >
                <option value="paid">ຈ່າຍແລ້ວ</option>
                <option value="unpaid">ຕິດໜີ້</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">ປະເພດສາງທີ່ຂາຍອອກ</span>
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
                <option value="warehouse">ສາງ</option>
                <option value="vehicle">ລົດ</option>
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
                  <SearchableSelect
                    label="Product"
                    options={productOptions}
                    value={line.productId}
                    onChange={(productId) => {
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
                    placeholder="Search product name"
                  />
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
                  <th className="px-4 py-3 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sales.length > 0 ? (
                  sales.map((item) => {
                    const sourceName = item.sourceWarehouse?.warehouse_name ?? item.sourceVehicle?.vehicle_name ?? "Unknown";
                    const itemSummary = item.details
                      ?.map((detail) => `${detail.product ? getProductLabel(detail.product) : `Product ${detail.product_id}`} (${detail.quantity_sold})`)
                      .join(", ") ?? "No items";

                    return (
                      <tr key={item.order_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">SO-{item.order_id}</td>
                        <td className="px-4 py-3 text-slate-600">{item.customer_name ?? "Walk-in Customer"}</td>
                        <td className="px-4 py-3 text-slate-600">{item.salesperson?.staff_name ?? "Unknown"}</td>
                        <td className="px-4 py-3 text-slate-600">{sourceName}</td>
                        <td className="px-4 py-3 text-slate-600">{itemSummary}</td>
                        <td className="px-4 py-3 text-cyan-700">{formatCurrency(Number(item.total_amount || 0))}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(item.order_date)}</td>
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
                            onClick={() => setInvoiceOrder(item)}
                            className="font-medium text-cyan-700 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-900"
                          >
                            Invoice
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

      {invoiceOrder && (
        <div className="invoice-overlay" role="presentation" onClick={() => setInvoiceOrder(null)}>
          <div
            className="invoice-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invoice-toolbar">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
              >
                Print invoice
              </button>
              <button
                type="button"
                onClick={() => setInvoiceOrder(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <article className="invoice-paper">
              <header className="invoice-header">
                <div className="invoice-company">
                  <BrandMark />
                  <strong>DVK LAO SOLE COMPANY LIMITED</strong>
                  <p>Sales Automotive Division (Engine Oil &amp; Spare Parts)</p>
                  <p>Thadeua Rd, Nahai Village, Hatxayfong District, Vientiane Capital Lao P.D.R</p>
                  <p>Tel: (+856 20) 51987895, 91556619</p>
                  <p>Email: duangsavanhDVK@gmail.com</p>
                </div>
                <h1 id="invoice-title">Invoice</h1>
              </header>

              <div className="invoice-order-details">
                <div>
                  <h2>Bill to</h2>
                  <strong>{invoiceOrder.customer?.customer_name ?? invoiceOrder.customer_name ?? "Walk-in Customer"}</strong>
                  <p>Tel: {invoiceOrder.customer?.phone_number || "—"}</p>
                  {invoiceOrder.customer?.place_link && <p>Location: {invoiceOrder.customer.place_link}</p>}
                </div>
                <dl className="invoice-meta">
                  <div>
                    <dt>Invoice No.</dt>
                    <dd>{getInvoiceNumber(invoiceOrder)}</dd>
                  </div>
                  <div>
                    <dt>Refer No.</dt>
                    <dd>SO-{invoiceOrder.order_id}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{formatDate(invoiceOrder.order_date)}</dd>
                  </div>
                  <div>
                    <dt>Credit term</dt>
                    <dd>30 days</dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{getDueDate(invoiceOrder.order_date)}</dd>
                  </div>
                  <div>
                    <dt>Sales</dt>
                    <dd>{invoiceOrder.salesperson?.staff_name ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Payment status</dt>
                    <dd>{invoiceOrder.is_paid ? "Paid" : "Unpaid"}</dd>
                  </div>
                </dl>
              </div>

              <div className="invoice-items-wrap">
                <table className="invoice-items">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Product description</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>QTY</th>
                      <th>Unit</th>
                      <th>Unit price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceDetails.map((detail, index) => (
                        <tr key={`${invoiceOrder.order_id}-${detail.product_id}`}>
                          <td>{index + 1}</td>
                          <td>{detail.product?.product_name ?? `Product ${detail.product_id}`}</td>
                          <td>{detail.product?.type || "—"}</td>
                          <td>{detail.product?.size || "—"}</td>
                          <td>{detail.quantity_sold}</td>
                          <td>{detail.product?.unit || "—"}</td>
                          <td>{formatCurrency(Number(detail.sold_at_price))}</td>
                          <td>{formatCurrency(Number(detail.quantity_sold) * Number(detail.sold_at_price))}</td>
                        </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={4}>Total</th>
                      <th>{invoiceQuantity}</th>
                      <th></th>
                      <th></th>
                      <th>{formatCurrency(invoiceSubtotal)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="invoice-summary">
                <dl>
                  <div className="invoice-grand-total">
                    <dt>Grand total</dt>
                    <dd>{formatCurrency(Number(invoiceOrder.total_amount || 0))}</dd>
                  </div>
                </dl>
              </div>

              <section className="invoice-remarks" aria-label="Invoice remarks">
                <h2>ໝາຍເຫດ</h2>
                <ol>
                  <li>ຈັດສົ່ງເຄື່ອງໃຫ້ພາຍໃນ 7-10 ວັນ</li>
                  <li>
                    ລູກຄ້າສາມາດຊຳລະເປັນເງິນສົດ, ແຊັກ ແລະ ເງິນໂອນກໍໄດ
                    <ul>
                      <li>
                        ຊື່: ທະນາຄານພັດທະນາລາວ · ຊື່ບັນຊີ: DOUANGSAVANH KHAMPASERD MR ·
                        ເລກບັນຊີ: 0300900410039654 KIP · ເລກບັນຊີ: 0300902410000954 THB
                      </li>
                      <li>
                        ຊື່: ທະນາຄານການຄ້າຕ່າງປະເທດລາວ · ຊື່ບັນຊີ: MR. DOUNGSAVANH KHAMPASEUTH ·
                        ເລກບັນຊີ: 010120000351222001 KIP · ເລກບັນຊີ: 093120200351222001 THB
                      </li>
                    </ul>
                  </li>
                  <li>ຖ້າໄດ້ຮັບເອກະສານ ບໍ່ຈະແຈ້ງ, ບໍ່ຊັດເຈນກະລຸນາແຈ້ງທີ່ເບີໂທ: 020 55119779; 020 22234428</li>
                </ol>
              </section>

              <div className="invoice-signatures">
                <div>
                  <span>Customer signature</span>
                  <div className="invoice-signature-line" />
                </div>
                <div>
                  <span>Seller signature</span>
                  <div className="invoice-signature-line" />
                </div>
              </div>

              <p className="invoice-thanks">Thank you for your business.</p>
            </article>
          </div>
        </div>
      )}
    </main>
  );
}
