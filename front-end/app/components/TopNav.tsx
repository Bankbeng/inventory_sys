"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "./BrandMark";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stock", label: "ຂົນຍ້າຍ" },
  { href: "/stock-remaining", label: "ເຄື່ອງຍັງເຫຼືອ" },
  { href: "/products", label: "ສິນຄ້າ" },
  { href: "/staff", label: "ພະນັກງານ" },
  { href: "/customers", label: "ລູກຄ້າ" },
  { href: "/warehouses", label: "ສາງ" },
  { href: "/vehicles", label: "ລົດ" },
  { href: "/sales", label: "ຂາຍ" },
  { href: "/sales-management", label: "Manage sales orders" },
  { href: "/accounts-receivable", label: "ໜີ້ຕ້ອງຮັບ" },
  { href: "/sales-kpi", label: "ຍອດຂາຍ" },
  { href: "/transactions", label: "ປະຫວັດ" },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(async () => {
      try {
        const response = await fetch("/api/access-check?all=true", { cache: "no-store" });
        const data = await response.json();
        if (response.status === 401) {
          if (!cancelled) {
            setAllowedPages([]);
            setStaffName(null);
            router.replace("/login");
          }
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || "Failed to load page permissions.");
        }
        if (!cancelled) {
          setAllowedPages(Array.isArray(data.allowed_pages) ? data.allowed_pages : []);
          setStaffName(typeof data.staff_name === "string" ? data.staff_name : null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load page permissions", error);
          setAllowedPages([]);
          setStaffName(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function handleLogout() {
    setLoggingOut(true);
    setMenuOpen(false);
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-white/95 shadow-sm backdrop-blur-md">
      <nav className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center"
        >
          <BrandMark />
        </Link>

        <div className="flex items-center gap-2">
          {staffName && (
            <span className="max-w-40 truncate text-sm font-medium text-slate-700 sm:max-w-56">
              {staffName}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-900 disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "ອອກຈາກລະບົບ"}
          </button>
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="top-navigation-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-600"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div
            id="top-navigation-menu"
            className="absolute inset-x-0 top-full z-50 border-b border-slate-300 bg-white p-4 shadow-lg sm:rounded-b-xl sm:border-x"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {navItems.filter((item) => allowedPages?.includes(item.href)).map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-cyan-700 text-white shadow-sm"
                        : "bg-slate-100 text-slate-800 hover:bg-cyan-50 hover:text-cyan-900",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}

            </div>
          </div>
        )}
      </nav>
      {logoutError && (
        <p role="alert" className="mx-auto max-w-7xl px-4 pb-2 text-right text-xs text-rose-700 sm:px-6 lg:px-8">
          {logoutError}
        </p>
      )}
    </header>
  );
}
