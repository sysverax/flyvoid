export const NAVIGATION_ITEMS = [
  { title: "Dashboard", path: "/", key: "dashboard" },
  { title: "Airlines", path: "/airlines", key: "airlines" },
  { title: "Airports", path: "/airports", key: "airports" },
  { title: "Cancellation", path: "/cancellation", key: "cancelledFlights" },
  { title: "Payments", path: "/payments", key: "payments" },
  { title: "Onboarding", path: "/onboarding", key: "invitesOnboarding" },
  { title: "Audit Logs", path: "/audit-logs", key: "auditLogs" },
  { title: "Manage Users", path: "/manage-users", key: "systemSettings" },
  { title: "Admin Profile", path: "/profile", key: "profile" },
];

export const getModuleKey = (path: string): string => {
  if (path === "/") return "dashboard";
  const found = NAVIGATION_ITEMS.find((item) => item.path !== "/" && path.startsWith(item.path));
  return found ? found.key : "";
};
