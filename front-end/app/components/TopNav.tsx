"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stock", label: "Stock" },
  { href: "/products", label: "Products" },
  { href: "/staff", label: "Staff" },
  { href: "/warehouses", label: "Warehouses" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/sales", label: "Sales" },
  { href: "/transactions", label: "Transactions" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-[0.2em] text-cyan-600 uppercase"
        >
          Inventory
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
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

          <Link
            href="/login"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:text-slate-900"
          >
            Login
          </Link>
        </div>
      </nav>
    </header>
  );
}
