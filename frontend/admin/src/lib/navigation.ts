import { PAYMENTS_ENABLED } from "./constants";

export const NAVIGATION_ITEMS = [
  { title: "Dashboard", path: "/", key: "dashboard" },
  { title: "Airlines", path: "/airlines", key: "airlines" },
  { title: "Airports", path: "/airports", key: "airports" },
  { title: "Cancellation", path: "/cancellation", key: "cancelledFlights" },
  { title: "Bookings", path: "/bookings", key: "hotelBookings" },
  { title: "Hotels", path: "/hotels", key: "hotels" },
  { title: "Payments", path: "/payments", key: "payments" },
  { title: "Onboarding", path: "/onboarding", key: "invitesOnboarding" },
  { title: "Audit Logs", path: "/audit-logs", key: "auditLogs" },
  { title: "Manage Users", path: "/manage-users", key: "manageUsers" },
  { title: "Admin Profile", path: "/profile", key: "profile" },
].filter((item) => PAYMENTS_ENABLED || item.key !== "payments");

export const getModuleKey = (path: string): string => {
  if (path === "/") return "dashboard";
  const found = NAVIGATION_ITEMS.find((item) => item.path !== "/" && path.startsWith(item.path));
  return found ? found.key : "";
};
