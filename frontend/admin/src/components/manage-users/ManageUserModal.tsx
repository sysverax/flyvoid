"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { cn } from "@/src/lib/utils";

import { User } from "@/src/services/users.service";

interface UserPermissions {
  [key: string]: {
    view: boolean;
    edit: boolean;
    export: boolean;
    all: boolean;
  };
}

interface ManageUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    firstName: string,
    lastName: string,
    email: string,
    isActive: boolean,
    accessControls: Array<{ asset: string; access: string[] }>
  ) => void;
  editingUser: User | null;
  isLoading: boolean;
}

interface PermissionRow {
  key: string;
  label: string;
  category?: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "airlines", label: "Airlines" },
  { key: "cancelledFlights", label: "Cancelled Flights" },
  { key: "platformOverview", label: "Platform Overview", category: "PAYMENTS & REVENUE" },
  { key: "detailedAnalysis", label: "Detailed Analysis", category: "PAYMENTS & REVENUE" },
  { key: "platformTreasury", label: "Platform Treasury", category: "PAYMENTS & REVENUE" },
  { key: "invitesOnboarding", label: "Invites & Onboarding" },
  { key: "systemSettings", label: "System Settings" },
  { key: "auditLogs", label: "Audit Logs" },
];

const emptyPermissions = (): UserPermissions => ({
  dashboard: { view: false, edit: false, export: false, all: false },
  airlines: { view: false, edit: false, export: false, all: false },
  cancelledFlights: { view: false, edit: false, export: false, all: false },
  platformOverview: { view: false, edit: false, export: false, all: false },
  detailedAnalysis: { view: false, edit: false, export: false, all: false },
  platformTreasury: { view: false, edit: false, export: false, all: false },
  invitesOnboarding: { view: false, edit: false, export: false, all: false },
  systemSettings: { view: false, edit: false, export: false, all: false },
  auditLogs: { view: false, edit: false, export: false, all: false },
});

function superAdminPermissions(): UserPermissions {
  return {
    dashboard: { view: true, edit: true, export: true, all: true },
    airlines: { view: true, edit: true, export: true, all: true },
    cancelledFlights: { view: true, edit: true, export: true, all: true },
    platformOverview: { view: true, edit: true, export: true, all: true },
    detailedAnalysis: { view: true, edit: true, export: true, all: true },
    platformTreasury: { view: true, edit: true, export: true, all: true },
    invitesOnboarding: { view: true, edit: true, export: true, all: true },
    systemSettings: { view: true, edit: true, export: true, all: true },
    auditLogs: { view: true, edit: true, export: true, all: true },
  };
}

function mapBackendAccessControlsToFrontend(
  backendAccessControls?: Array<{ asset: string; access: string[] }>,
  role?: string
): UserPermissions {
  if (role === "SUPER_ADMIN") {
    return superAdminPermissions();
  }

  const permissions = emptyPermissions();
  if (!backendAccessControls) return permissions;

  backendAccessControls.forEach((ac) => {
    const access = {
      view: ac.access.includes("VIEW"),
      edit: ac.access.includes("EDIT"),
      export: ac.access.includes("EXPORT"),
      all: ac.access.includes("VIEW") && ac.access.includes("EDIT") && ac.access.includes("EXPORT"),
    };

    if (ac.asset === "DASHBOARD") permissions.dashboard = access;
    else if (ac.asset === "AIRLINES") permissions.airlines = access;
    else if (ac.asset === "CANCELLED_FLIGHTS") permissions.cancelledFlights = access;
    else if (ac.asset === "INVITES_ONBOARDING") permissions.invitesOnboarding = access;
    else if (ac.asset === "SYSTEM_SETTINGS") permissions.systemSettings = access;
    else if (ac.asset === "AUDIT_LOGS") permissions.auditLogs = access;
    else if (ac.asset === "PAYMENTS" || ac.asset === "REVENUE") {
      permissions.platformOverview = { ...access };
      permissions.detailedAnalysis = { ...access };
      permissions.platformTreasury = { ...access };
    }
  });

  return permissions;
}

function mapFrontendPermissionsToBackend(
  frontendPerms: UserPermissions
): Array<{ asset: string; access: string[] }> {
  const accessControls: Array<{ asset: string; access: string[] }> = [];

  const addAsset = (asset: string, perm: { view: boolean; edit: boolean; export: boolean }) => {
    const access: string[] = [];
    if (perm.view) access.push("VIEW");
    if (perm.edit) access.push("EDIT");
    if (perm.export) access.push("EXPORT");
    if (access.length > 0) {
      accessControls.push({ asset, access });
    }
  };

  if (frontendPerms.dashboard) addAsset("DASHBOARD", frontendPerms.dashboard);
  if (frontendPerms.airlines) addAsset("AIRLINES", frontendPerms.airlines);
  if (frontendPerms.cancelledFlights) addAsset("CANCELLED_FLIGHTS", frontendPerms.cancelledFlights);
  if (frontendPerms.invitesOnboarding) addAsset("INVITES_ONBOARDING", frontendPerms.invitesOnboarding);
  if (frontendPerms.systemSettings) addAsset("SYSTEM_SETTINGS", frontendPerms.systemSettings);
  if (frontendPerms.auditLogs) addAsset("AUDIT_LOGS", frontendPerms.auditLogs);

  // Merge platformOverview, detailedAnalysis, platformTreasury into PAYMENTS
  const paymentsView = frontendPerms.platformOverview?.view || frontendPerms.detailedAnalysis?.view || frontendPerms.platformTreasury?.view;
  const paymentsEdit = frontendPerms.platformOverview?.edit || frontendPerms.detailedAnalysis?.edit || frontendPerms.platformTreasury?.edit;
  const paymentsExport = frontendPerms.platformOverview?.export || frontendPerms.detailedAnalysis?.export || frontendPerms.platformTreasury?.export;

  const paymentsAccess: string[] = [];
  if (paymentsView) paymentsAccess.push("VIEW");
  if (paymentsEdit) paymentsAccess.push("EDIT");
  if (paymentsExport) paymentsAccess.push("EXPORT");

  if (paymentsAccess.length > 0) {
    accessControls.push({ asset: "PAYMENTS", access: paymentsAccess });
    accessControls.push({ asset: "REVENUE", access: paymentsAccess });
  }

  return accessControls;
}

export function ManageUserModal({
  isOpen,
  onClose,
  onSave,
  editingUser,
  isLoading,
}: ManageUserModalProps) {
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userStatus, setUserStatus] = useState<"Active" | "Inactive">("Active");
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(emptyPermissions());
  const [errors, setErrors] = useState<{ userName?: string; userEmail?: string }>({});
  const [touched, setTouched] = useState<{ userName?: boolean; userEmail?: boolean }>({});

  const validateField = (field: "userName" | "userEmail", value: string) => {
    let error: string | undefined;
    if (field === "userName") {
      if (!value.trim()) {
        error = "User Name is required";
      }
    } else if (field === "userEmail") {
      if (!value.trim()) {
        error = "Email is required";
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          error = "Please enter a valid email address";
        }
      }
    }
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleBlur = (field: "userName" | "userEmail") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const val = field === "userName" ? userName : userEmail;
    validateField(field, val);
  };

  const handleNameChange = (val: string) => {
    setUserName(val);
    if (touched.userName) {
      validateField("userName", val);
    } else if (errors.userName) {
      setErrors((prev) => ({ ...prev, userName: undefined }));
    }
  };

  const handleEmailChange = (val: string) => {
    setUserEmail(val);
    if (touched.userEmail) {
      validateField("userEmail", val);
    } else if (errors.userEmail) {
      setErrors((prev) => ({ ...prev, userEmail: undefined }));
    }
  };

  useEffect(() => {
    if (editingUser) {
      setUserName(`${editingUser.firstName} ${editingUser.lastName}`.trim());
      setUserEmail(editingUser.email);
      setUserStatus(editingUser.isActive ? "Active" : "Inactive");
      setUserPermissions(mapBackendAccessControlsToFrontend(editingUser.accessControls, editingUser.role));
    } else {
      setUserName("");
      setUserEmail("");
      setUserStatus("Active");
      setUserPermissions(emptyPermissions());
    }
    setErrors({});
    setTouched({});
  }, [editingUser, isOpen]);

  const togglePermission = (moduleKey: string, level: "view" | "edit" | "export" | "all") => {
    setUserPermissions((prev) => {
      const modulePerms = { ...prev[moduleKey] };
      if (level === "all") {
        const newVal = !modulePerms.all;
        return {
          ...prev,
          [moduleKey]: {
            view: newVal,
            edit: newVal,
            export: newVal,
            all: newVal,
          },
        };
      } else {
        modulePerms[level] = !modulePerms[level];
        modulePerms.all = modulePerms.view && modulePerms.edit && modulePerms.export;
        return {
          ...prev,
          [moduleKey]: modulePerms,
        };
      }
    });
  };

  const allViewChecked = PERMISSION_ROWS.every((row) => userPermissions[row.key]?.view);
  const allEditChecked = PERMISSION_ROWS.every((row) => userPermissions[row.key]?.edit);
  const allExportChecked = PERMISSION_ROWS.every((row) => userPermissions[row.key]?.export);
  const allAllChecked = PERMISSION_ROWS.every((row) => userPermissions[row.key]?.all);

  const toggleColumnAll = (level: "view" | "edit" | "export" | "all") => {
    setUserPermissions((prev) => {
      const keys = PERMISSION_ROWS.map((row) => row.key);
      const allTrue = keys.every((key) => prev[key]?.[level]);
      const newValue = !allTrue;

      const updated = { ...prev };
      keys.forEach((key) => {
        if (!updated[key]) {
          updated[key] = { view: false, edit: false, export: false, all: false };
        }
        if (level === "all") {
          updated[key] = {
            view: newValue,
            edit: newValue,
            export: newValue,
            all: newValue,
          };
        } else {
          updated[key] = {
            ...updated[key],
            [level]: newValue,
          };
          updated[key].all = updated[key].view && updated[key].edit && updated[key].export;
        }
      });
      return updated;
    });
  };

  const hasChanges = useMemo(() => {
    if (!editingUser) return true;

    const initialName = `${editingUser.firstName} ${editingUser.lastName}`.trim();
    if (userName.trim() !== initialName) return true;
    if (userEmail.trim() !== editingUser.email) return true;

    const initialStatus = editingUser.isActive ? "Active" : "Inactive";
    if (userStatus !== initialStatus) return true;

    const initialPerms = mapBackendAccessControlsToFrontend(editingUser.accessControls, editingUser.role);
    const keys = Object.keys(userPermissions);
    for (const key of keys) {
      const p1 = userPermissions[key] || { view: false, edit: false, export: false };
      const p2 = initialPerms[key] || { view: false, edit: false, export: false };
      if (p1.view !== p2.view || p1.edit !== p2.edit || p1.export !== p2.export) {
        return true;
      }
    }

    return false;
  }, [editingUser, userName, userEmail, userStatus, userPermissions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { userName?: string; userEmail?: string } = {};

    if (!userName.trim()) {
      newErrors.userName = "User Name is required";
    }

    if (!userEmail.trim()) {
      newErrors.userEmail = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail)) {
        newErrors.userEmail = "Please enter a valid email address";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({ userName: true, userEmail: true });
      return;
    }

    setErrors({});

    const nameParts = userName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");
    const isActive = userStatus === "Active";
    const accessControls = mapFrontendPermissionsToBackend(userPermissions);

    onSave(firstName, lastName, userEmail, isActive, accessControls);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={isLoading ? () => {} : onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[640px] max-w-full bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out p-6 justify-between gap-6",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Main Body (Header + Forms) */}
        <div ref={scrollContainerRef} className="self-stretch flex-1 flex flex-col justify-start items-start gap-6 overflow-y-auto pr-1 scrollbar-hide pb-4 pl-[1px]">

          {/* Header */}
          <div className="self-stretch inline-flex justify-between items-start">
            <div className="inline-flex flex-col justify-start items-start gap-1">
              <h2 className="self-stretch justify-start text-gray-800 text-2xl font-semibold font-figtree">
                {editingUser ? "Edit User Details" : "Add New User"}
              </h2>
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="size-6 text-gray-800 hover:text-gray-600 transition-colors flex items-center justify-center cursor-pointer relative left-1 disabled:opacity-50 disabled:cursor-default"
            >
              <X className="w-5 h-5 text-gray-800" />
            </button>
          </div>

          {/* Form Content */}
          <form id="manage-user-form" onSubmit={handleSubmit} noValidate className="self-stretch flex flex-col justify-start items-start gap-6 w-full">

            {/* User Name & Email inputs */}
            <div className="self-stretch inline-flex justify-start items-start gap-5 relative -top-0.5">
              {/* User Name */}
              <div className="flex-1 inline-flex flex-col justify-start items-start">
                <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2.5">
                  <label className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">User Name *</label>
                  <input
                    type="text"
                    placeholder="Enter user name"
                    value={userName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => handleBlur("userName")}
                    required
                    disabled={isLoading}
                    className={cn(
                      "self-stretch flex-1 px-4 py-3 bg-[#F9FAFB] rounded-[10px] border transition-all text-base font-figtree text-gray-800 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed",
                      errors.userName
                        ? "border-red-500 focus:ring-red-500/10 focus:border-red-500"
                        : "border-gray-300 focus:border-[#0F2757] focus:ring-[#0F2757]/10"
                    )}
                  />
                  {errors.userName && (
                    <span className="text-red-500 text-xs font-medium font-figtree pl-1 -mt-1.5">
                      {errors.userName}
                    </span>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="flex-1 inline-flex flex-col justify-start items-start">
                <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2.5">
                  <label className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">Email *</label>
                  <input
                    type="email"
                    placeholder="Enter user email"
                    value={userEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={() => handleBlur("userEmail")}
                    required
                    disabled={isLoading}
                    className={cn(
                      "self-stretch flex-1 px-4 py-3 bg-[#F9FAFB] rounded-[10px] border transition-all text-base font-figtree text-gray-800 placeholder-gray-500 focus:bg-white focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed",
                      errors.userEmail
                        ? "border-red-500 focus:ring-red-500/10 focus:border-red-500"
                        : "border-gray-300 focus:border-[#0F2757] focus:ring-[#0F2757]/10"
                    )}
                  />
                  {errors.userEmail && (
                    <span className="text-red-500 text-xs font-medium font-figtree pl-1 -mt-1.5">
                      {errors.userEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Access Level Grid */}
            <div className="self-stretch flex flex-col justify-start items-start gap-3.5 w-full relative -top-1">

              {/* Select access level Header */}
              <div className="self-stretch pb-3 border-b border-gray-300 inline-flex justify-start items-center gap-6">
                <div className="min-w-[248px] flex-1 justify-start text-gray-800 text-base font-semibold font-figtree leading-[100%]">Select access level</div>
                <div className="flex justify-start items-center gap-3">

                  {/* View All */}
                  <div className="min-w-[92px] flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("view")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                        allViewChecked
                          ? "bg-blue-950 border-blue-950 text-white"
                          : "bg-white border-gray-300 text-transparent"
                      )}
                    >
                      {allViewChecked && (
                        <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-gray-500 text-sm font-normal font-figtree select-none">All</span>
                  </div>

                  {/* Edit All */}
                  <div className="min-w-14 flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("edit")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                        allEditChecked
                          ? "bg-blue-950 border-blue-950 text-white"
                          : "bg-white border-gray-300 text-transparent"
                      )}
                    >
                      {allEditChecked && (
                        <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-gray-500 text-sm font-normal font-figtree select-none">All</span>
                  </div>

                  {/* Export All */}
                  <div className="min-w-18 flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("export")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                        allExportChecked
                          ? "bg-blue-950 border-blue-950 text-white"
                          : "bg-white border-gray-300 text-transparent"
                      )}
                    >
                      {allExportChecked && (
                        <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-gray-500 text-sm font-normal font-figtree select-none">All</span>
                  </div>

                  {/* All All */}
                  <div className="min-w-[62px] flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("all")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                        allAllChecked
                          ? "bg-blue-950 border-blue-950 text-white"
                          : "bg-white border-gray-300 text-transparent"
                      )}
                    >
                      {allAllChecked && (
                        <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="text-gray-500 text-sm font-normal font-figtree select-none">All</span>
                  </div>

                </div>
              </div>

              {/* Rows */}
              {PERMISSION_ROWS.map((row, idx) => {
                const isLast = idx === PERMISSION_ROWS.length - 1;
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "self-stretch pb-[13px] inline-flex justify-start items-center gap-6 -translate-y-1.5",
                      !isLast && "border-b border-gray-300"
                    )}
                  >
                    <div className="min-w-[248px] flex-1 inline-flex flex-col justify-center items-start gap-px ">
                      {row.category && (
                        <div className="self-stretch justify-start text-gray-500 text-xs font-semibold font-figtree uppercase ">
                          {row.category}
                        </div>
                      )}
                      <div className="self-stretch justify-start text-gray-800 text-base font-medium font-figtree leading-[110%]">
                        {row.label}
                      </div>
                    </div>

                    <div className="flex justify-start items-center gap-3">

                      {/* View check */}
                      <div className="min-w-[92px] flex justify-start items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePermission(row.key, "view")}
                          className={cn(
                            "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                            userPermissions[row.key]?.view
                              ? "bg-blue-950 border-blue-950 text-white"
                              : "bg-white border-gray-300 text-transparent"
                          )}
                        >
                          {userPermissions[row.key]?.view && (
                            <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-gray-500 text-sm font-normal font-figtree select-none">View Only</span>
                      </div>

                      {/* Edit check */}
                      <div className="min-w-14 flex justify-start items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePermission(row.key, "edit")}
                          className={cn(
                            "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                            userPermissions[row.key]?.edit
                              ? "bg-blue-950 border-blue-950 text-white"
                              : "bg-white border-gray-300 text-transparent"
                          )}
                        >
                          {userPermissions[row.key]?.edit && (
                            <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-gray-500 text-sm font-normal font-figtree select-none">Edit</span>
                      </div>

                      {/* Export check */}
                      <div className="min-w-18 flex justify-start items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePermission(row.key, "export")}
                          className={cn(
                            "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                            userPermissions[row.key]?.export
                              ? "bg-blue-950 border-blue-950 text-white"
                              : "bg-white border-gray-300 text-transparent"
                          )}
                        >
                          {userPermissions[row.key]?.export && (
                            <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-gray-500 text-sm font-normal font-figtree select-none">Export</span>
                      </div>

                      {/* All check */}
                      <div className="min-w-[62px] flex justify-start items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePermission(row.key, "all")}
                          className={cn(
                            "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border shrink-0",
                            userPermissions[row.key]?.all
                              ? "bg-blue-950 border-blue-950 text-white"
                              : "bg-white border-gray-300 text-transparent"
                          )}
                        >
                          {userPermissions[row.key]?.all && (
                            <svg className="size-2.5 stroke-[3.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-gray-500 text-sm font-normal font-figtree select-none">All</span>
                      </div>

                    </div>
                  </div>
                );
              })}

            </div>

            {/* Status Switch Block */}
            <div className="w-[592px] max-w-full h-[82px] p-5 bg-gray-100 rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex justify-between items-center relative -top-3">
              <div className="flex justify-start items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUserStatus((prev) => (prev === "Active" ? "Inactive" : "Active"))}
                  className={cn(
                    "w-11 h-6 p-0.5 rounded-xl flex items-center overflow-hidden transition-all duration-200 cursor-pointer",
                    userStatus === "Active" ? "bg-blue-950 justify-end" : "bg-gray-300 justify-start"
                  )}
                >
                  <div className="size-5 bg-white rounded-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06),_0px_1px_3px_0px_rgba(0,0,0,0.10)]"></div>
                </button>
                <div className="inline-flex flex-col justify-start items-start gap-1.5">
                  <div className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">Update Status</div>
                  <div className="justify-start text-gray-500 text-sm font-normal font-figtree">This will affect the status of the particular user.</div>
                </div>
              </div>
              <div className={cn(
                "px-2.5 py-0.5 rounded-2xl flex justify-center items-center font-inter text-xs font-medium leading-4",
                userStatus === "Active" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-800"
              )}>
                {userStatus}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="self-stretch inline-flex justify-start items-start gap-3 shrink-0 relative -top-4.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-[54px] flex-1 px-6 py-4 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center overflow-hidden text-gray-800 text-lg font-normal font-figtree bg-white transition-colors cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-default"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="manage-user-form"
            disabled={!hasChanges || isLoading}
            className="h-[54px] flex-1 px-6 py-4 bg-blue-950 rounded-[10px] flex justify-center items-center overflow-hidden text-white text-lg font-normal font-figtree transition-colors cursor-pointer hover:bg-[#1a3465] active:bg-[#091a3c] disabled:opacity-75 disabled:cursor-default"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{editingUser ? "Saving..." : "Adding..."}</span>
              </div>
            ) : editingUser ? (
              "Save Changes"
            ) : (
              "Add Now"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
