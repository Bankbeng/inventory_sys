"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

type Product = {
  product_id: number;
  product_name: string;
  category: string;
  cost_price: number;
  retail_price: number;
};

type ProductFormState = {
  product_name: string;
  category: string;
  cost_price: string;
  retail_price: string;
};

const emptyForm: ProductFormState = {
  product_name: "",
  category: "",
  cost_price: "",
  retail_price: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadProducts() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load products", error);
      setMessage("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const handleChange = (field: keyof ProductFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.product_name.trim() || !form.category.trim()) {
      setMessage("Product name and category are required.");
      return;
    }

    if (!Number(form.cost_price) && form.cost_price.trim() !== "0") {
      setMessage("Cost price must be a valid number.");
      return;
    }

    if (!Number(form.retail_price) && form.retail_price.trim() !== "0") {
      setMessage("Retail price must be a valid number.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        product_name: form.product_name.trim(),
        category: form.category.trim(),
        cost_price: Number(form.cost_price),
        retail_price: Number(form.retail_price),
      };

      const response = await fetch(
        editingId ? `${API_BASE_URL}/api/products/${editingId}` : `${API_BASE_URL}/api/products`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      resetForm();
      await loadProducts();
      setMessage(editingId ? "Product updated successfully." : "Product added successfully.");
    } catch (error) {
      console.error("Product save failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: number) {
    const product = products.find((item) => item.product_id === productId);
    if (!product) return;

    if (!window.confirm(`Delete ${product.product_name}?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Delete failed");
      }

      await loadProducts();
      if (editingId === productId) resetForm();
      setMessage("Product deleted successfully.");
    } catch (error) {
      console.error("Product delete failed", error);
      setMessage(error instanceof Error ? error.message : "Failed to delete product.");
    }
  }

  function handleEdit(product: Product) {
    setEditingId(product.product_id);
    setForm({
      product_name: product.product_name,
      category: product.category,
      cost_price: String(product.cost_price),
      retail_price: String(product.retail_price),
    });
    setMessage(null);
  }

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-600">Catalog</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Products</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Product name</span>
              <input
                value={form.product_name}
                onChange={(event) => handleChange("product_name", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                placeholder="Rice Bag 25kg"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Category</span>
              <input
                value={form.category}
                onChange={(event) => handleChange("category", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                placeholder="Staples"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Cost price</span>
              <input
                type="number"
                step="0.01"
                value={form.cost_price}
                onChange={(event) => handleChange("cost_price", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                placeholder="35.00"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block">Retail price</span>
              <input
                type="number"
                step="0.01"
                value={form.retail_price}
                onChange={(event) => handleChange("retail_price", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-cyan-400"
                placeholder="45.00"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update product" : "Save product"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear form
              </button>
            )}
          </div>

          {message && <p className="mt-4 text-sm text-cyan-700">{message}</p>}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            Loading products...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <article key={product.product_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                    {product.category}
                  </span>
                  <span className="text-xs text-slate-500">#{product.product_id}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">{product.product_name}</h2>
                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <p>Cost: <span className="font-medium text-slate-900">${Number(product.cost_price).toFixed(2)}</span></p>
                  <p>Retail: <span className="font-medium text-cyan-700">${Number(product.retail_price).toFixed(2)}</span></p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(product)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-900"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.product_id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
