"use client";

import { useEffect, useState } from "react";

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
      const response = await fetch("http://localhost:3000/api/products");
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
        editingId ? `http://localhost:3000/api/products/${editingId}` : "http://localhost:3000/api/products",
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
      const response = await fetch(`http://localhost:3000/api/products/${productId}`, {
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Catalog</p>
            <h1 className="mt-2 text-3xl font-bold">Products</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Product name</span>
              <input
                value={form.product_name}
                onChange={(event) => handleChange("product_name", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                placeholder="Rice Bag 25kg"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Category</span>
              <input
                value={form.category}
                onChange={(event) => handleChange("category", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                placeholder="Staples"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Cost price</span>
              <input
                type="number"
                step="0.01"
                value={form.cost_price}
                onChange={(event) => handleChange("cost_price", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                placeholder="35.00"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Retail price</span>
              <input
                type="number"
                step="0.01"
                value={form.retail_price}
                onChange={(event) => handleChange("retail_price", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                placeholder="45.00"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update product" : "Save product"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Clear form
              </button>
            )}
          </div>

          {message && <p className="mt-4 text-sm text-cyan-300">{message}</p>}
        </form>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
            Loading products...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <article key={product.product_id} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
                    {product.category}
                  </span>
                  <span className="text-xs text-slate-400">#{product.product_id}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">{product.product_name}</h2>
                <div className="mt-5 space-y-2 text-sm text-slate-300">
                  <p>Cost: <span className="font-medium text-white">${Number(product.cost_price).toFixed(2)}</span></p>
                  <p>Retail: <span className="font-medium text-cyan-300">${Number(product.retail_price).toFixed(2)}</span></p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(product)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.product_id)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
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
