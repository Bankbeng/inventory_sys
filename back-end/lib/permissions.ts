import { prisma } from "@/lib/prisma";

export const APP_PAGES = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/stock", label: "Stock" },
  { path: "/stock-remaining", label: "Remaining stock" },
  { path: "/products", label: "Products" },
  { path: "/customers", label: "Customers" },
  { path: "/warehouses", label: "Warehouses" },
  { path: "/vehicles", label: "Vehicles" },
  { path: "/sales", label: "Sales" },
  { path: "/accounts-receivable", label: "Receivables" },
  { path: "/sales-kpi", label: "Sales KPI" },
  { path: "/transactions", label: "Transactions" },
  { path: "/staff", label: "Staff management" },
] as const;

export function normalizeRole(role: string) {
  return role.trim().toLocaleLowerCase();
}

export function isAdminRole(role: string) {
  return normalizeRole(role) === "admin";
}

export async function getAllowedPages(role: string) {
  if (isAdminRole(role)) {
    return APP_PAGES.map(({ path }) => path);
  }

  const roleName = normalizeRole(role);
  const permissions = await prisma.rolePagePermission.findMany({
    where: { role_name: roleName },
  });

  if (permissions.length === 0) {
    return APP_PAGES.filter(({ path }) => path !== "/staff").map(({ path }) => path);
  }

  return permissions.filter(({ can_access }) => can_access).map(({ page_path }) => page_path);
}

export async function canAccessPage(role: string, pagePath: string) {
  if (!APP_PAGES.some(({ path }) => path === pagePath)) {
    return false;
  }
  if (pagePath === "/staff") {
    return isAdminRole(role);
  }
  const allowedPages = await getAllowedPages(role);
  return allowedPages.includes(pagePath);
}

export async function getCurrentStaff(staffId: number) {
  return prisma.staff.findUnique({
    where: { staff_id: staffId },
    select: { staff_id: true, staff_name: true, username: true, role: true },
  });
}

export function pagesForApi(path: string, method: string): string[] | null {
  if (path.startsWith("/api/staff/") || path === "/api/staff") {
    return method === "GET" ? ["/staff", "/sales", "/stock"] : [];
  }
  if (path.startsWith("/api/role-permissions")) {
    return [];
  }
  if (path.startsWith("/api/customers")) {
    return method === "GET" ? ["/customers", "/sales"] : ["/customers"];
  }
  if (path.startsWith("/api/sales-orders/") && path.includes("/payments")) {
    return ["/accounts-receivable"];
  }
  if (path.startsWith("/api/acknowledgements")) {
    return ["/transactions"];
  }
  if (path.startsWith("/api/sales-orders")) {
    return ["/sales", "/accounts-receivable", "/sales-kpi", "/dashboard", "/transactions"];
  }
  if (path.startsWith("/api/products")) {
    return ["/products", "/sales", "/stock", "/transactions"];
  }
  if (path.startsWith("/api/warehouses")) {
    return ["/warehouses", "/sales", "/stock"];
  }
  if (path.startsWith("/api/vehicles")) {
    return ["/vehicles", "/sales", "/stock"];
  }
  if (path.startsWith("/api/warehouse-stocks") || path.startsWith("/api/vehicle-stocks")) {
    return ["/stock", "/stock-remaining", "/dashboard"];
  }
  if (path.startsWith("/api/inventory-transactions")) {
    return ["/transactions", "/stock"];
  }
  return null;
}
