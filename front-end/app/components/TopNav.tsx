"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "./BrandMark";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stock", label: "Stock" },
  { href: "/stock-remaining", label: "Remaining stock" },
  { href: "/products", label: "Products" },
  { href: "/staff", label: "Staff" },
  { href: "/customers", label: "Customers" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/sales", label: "Sales" },
  { href: "/accounts-receivable", label: "Receivables" },
  { href: "/sales-kpi", label: "Sales KPI" },
  { href: "/transactions", label: "Transactions" },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/access-check?all=true", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load page permissions.");
        }
        if (!cancelled) {
          setAllowedPages(Array.isArray(data.allowed_pages) ? data.allowed_pages : []);
        }
      } catch (error) {
        console.error("Failed to load page permissions", error);
        if (!cancelled) {
          setAllowedPages([]);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Unable to sign out. Please try again.");
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center"
        >
          <BrandMark />
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {navItems.filter((item) => allowedPages?.includes(item.href)).map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-900 disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
        {logoutError && <span role="alert" className="text-xs text-rose-700">{logoutError}</span>}
      </nav>
    </header>
  );
}
