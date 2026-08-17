"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      alert(`Welcome ${data.user.staff_name}`);
      window.location.href = "/dashboard";
    } catch (error) {
      alert(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-cyan-950/20 lg:grid-cols-2">
        <div className="hidden bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-700 p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/80">Inventory Flow</p>
            <h1 className="mt-6 text-3xl font-bold text-white">Smart inventory operations</h1>
          </div>
          <div className="space-y-3 text-sm text-cyan-50/90">
            <p>• Real-time stock tracking</p>
            <p>• Warehouse and vehicle management</p>
            <p>• Sales and team monitoring</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Access</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Sign in</h2>
            </div>
            <Link href="/" className="text-sm text-slate-300 transition hover:text-white">
              Home
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Username</label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-400">
            Demo account: <span className="font-medium text-slate-200">admin / 123456</span>
          </div>
        </div>
      </div>
    </main>
  );
}
