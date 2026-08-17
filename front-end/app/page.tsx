import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-12">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Inventory System</p>
        <h1 className="mt-6 text-4xl font-bold text-slate-900 sm:text-5xl">
          Manage stock, sales, and teams in one place.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Keep warehouses, vehicles, products, and transactions organized with a clean white workspace designed for quick operations.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-500"
          >
            Open dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
