export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-12 text-slate-900">
      <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Access denied</p>
        <h1 className="mt-3 text-2xl font-bold">You don&apos;t have permission to view this page.</h1>
        <p className="mt-3 text-sm text-slate-600">
          Contact an administrator if you think you should have access.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Go to dashboard
        </a>
      </section>
    </main>
  );
}
