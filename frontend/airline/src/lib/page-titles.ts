/** Title and subtitle shown in the top bar, per route (longest matching prefix wins). */
export interface PageTitle {
  path: string;
  title: string;
  subtitle: string;
}

export const PAGE_TITLES: PageTitle[] = [
  { path: "/", title: "Dashboard", subtitle: "Overview of your airline operations" },
  {
    path: "/airports",
    title: "Airports",
    subtitle: "Manage and view your airline's operating airports",
  },
  {
    path: "/wallet",
    title: "Wallet",
    subtitle: "Full history of top-ups and deductions",
  },
  {
    path: "/cancelled-flight",
    title: "Cancelled Flights",
    subtitle: "Manage flight cancellations and hotel allocations",
  },
  {
    path: "/bookings",
    title: "Bookings",
    subtitle: "Confirmed hotel bookings from cancelled flights",
  },
  {
    path: "/payments",
    title: "Payments",
    subtitle:
      "Manage payment methods and view pending and completed hotel booking payments",
  },
  {
    path: "/manage-users",
    title: "Manage Users",
    subtitle: "Create and manage airline users and their module access",
  },
  {
    path: "/settings",
    title: "Settings",
    subtitle: "Manage your account settings and preferences",
  },
];

export function pageTitleFor(pathname: string | null): PageTitle | null {
  const path = pathname || "/";
  if (path === "/" || path === "/dashboard") return PAGE_TITLES[0];
  return (
    PAGE_TITLES.filter(
      (page) =>
        page.path !== "/" &&
        (path === page.path || path.startsWith(`${page.path}/`)),
    ).sort((a, b) => b.path.length - a.path.length)[0] ?? null
  );
}
