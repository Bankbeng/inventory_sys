"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

type Customer = {
  customer_id: number;
  customer_name: string;
  phone_number: string | null;
  place_link: string | null;
};

type CustomerForm = {
  customer_name: string;
  phone_number: string;
  place_link: string;
};

const emptyForm: CustomerForm = {
  customer_name: "",
  phone_number: "",
  place_link: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.customer_name,
        customer.phone_number ?? "",
        String(customer.customer_id),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [customers, searchQuery]);

  async function loadCustomers() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load customer records.");
      }
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load customers", error);
      setMessage(error instanceof Error ? error.message : "Failed to load customer records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadCustomers);
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.customer_name.trim()) {
      setMessage("Customer name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        editingId
          ? `${API_BASE_URL}/api/customers/${editingId}`
          : `${API_BASE_URL}/api/customers`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: form.customer_name.trim(),
            phone_number: form.phone_number.trim(),
            place_link: form.place_link.trim(),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save customer.");
      }

      resetForm();
      await loadCustomers();
      setMessage(editingId ? "Customer updated successfully." : "Customer added successfully.");
    } catch (error) {
      console.error("Customer save failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(customer: Customer) {
    setEditingId(customer.customer_id);
    setForm({
      customer_name: customer.customer_name,
      phone_number: customer.phone_number ?? "",
      place_link: customer.place_link ?? "",
    });
    setMessage(null);
  }

  async function handleDelete(customer: Customer) {
    if (!window.confirm(`Delete ${customer.customer_name}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customer.customer_id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete customer.");
      }

      if (editingId === customer.customer_id) {
        resetForm();
      }
      await loadCustomers();
      setMessage("Customer deleted successfully.");
    } catch (error) {
      console.error("Customer delete failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to delete customer.");
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Directory</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Customer management</h1>
          <p className="mt-2 text-sm text-slate-600">
            Save customer contact details. Only the customer name is required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Name <span className="text-rose-600">*</span></span>
              <input
                required
                value={form.customer_name}
                onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                placeholder="Customer name"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Phone number <span className="text-slate-400">(optional)</span></span>
              <input
                type="tel"
                value={form.phone_number}
                onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                placeholder="Phone number"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Google Maps link <span className="text-slate-400">(optional)</span></span>
              <input
                type="url"
                value={form.place_link}
                onChange={(event) => setForm((current) => ({ ...current, place_link: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                placeholder="https://maps.google.com/..."
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : editingId ? "Update customer" : "Save customer"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Cancel edit
              </button>
            )}
          </div>
          {message && <p role="status" className="mt-4 text-sm text-cyan-700">{message}</p>}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading customers...</div>
        ) : (
          <>
            {customers.length > 0 && (
              <div className="mb-4">
                <label htmlFor="customer-search" className="sr-only">Search customers</label>
                <input
                  id="customer-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by customer name, phone number, or ID"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                />
                <p className="mt-2 text-sm text-slate-500" aria-live="polite">
                  Showing {filteredCustomers.length} of {customers.length} customers
                </p>
              </div>
            )}
            {customers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No customers added yet.</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No customers match your search.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Phone number</th>
                    <th className="px-4 py-3 font-medium">Place</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.customer_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{customer.customer_name}</td>
                      <td className="px-4 py-3 text-slate-600">{customer.phone_number || "—"}</td>
                      <td className="px-4 py-3">
                        {customer.place_link ? (
                          <a
                            href={customer.place_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-700 underline"
                          >
                            Open map
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(customer)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(customer)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
