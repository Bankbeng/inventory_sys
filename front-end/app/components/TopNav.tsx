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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-[0.2em] text-cyan-300 uppercase"
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
                    ? "bg-cyan-500 text-slate-950"
                    : "bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}

          <Link
            href="/login"
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
          >
            Login
          </Link>
        </div>
      </nav>
    </header>
  );
}
