"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { cn } from "@/src/lib/utils";

interface UserPermissions {
  [key: string]: {
    view: boolean;
    edit: boolean;
    export: boolean;
    all: boolean;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Inactive";
  permissions: UserPermissions;
}

interface ManageUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, email: string, status: "Active" | "Inactive", permissions: UserPermissions) => void;
  editingUser: User | null;
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

export function ManageUserModal({
  isOpen,
  onClose,
  onSave,
  editingUser,
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

  useEffect(() => {
    if (editingUser) {
      setUserName(editingUser.name);
      setUserEmail(editingUser.email);
      setUserStatus(editingUser.status);
      setUserPermissions(JSON.parse(JSON.stringify(editingUser.permissions)));
    } else {
      setUserName("");
      setUserEmail("");
      setUserStatus("Active");
      setUserPermissions(emptyPermissions());
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(userName, userEmail, userStatus, userPermissions);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[640px] max-w-full bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out p-6 justify-between gap-6",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Main Body (Header + Forms) */}
        <div ref={scrollContainerRef} className="self-stretch flex-1 flex flex-col justify-start items-start gap-6 overflow-y-auto pr-1 scrollbar-hide pb-4">
          
          {/* Header */}
          <div className="self-stretch inline-flex justify-between items-start">
            <div className="inline-flex flex-col justify-start items-start gap-1">
              <h2 className="self-stretch justify-start text-gray-800 text-2xl font-semibold font-figtree">
                {editingUser ? "Edit User Details" : "Add New User"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-6 text-gray-800 hover:text-gray-600 transition-colors flex items-center justify-center cursor-pointer relative left-1"
            >
              <X className="w-5 h-5 text-gray-800" />
            </button>
          </div>

          {/* Form Content */}
          <form id="manage-user-form" onSubmit={handleSubmit} className="self-stretch flex flex-col justify-start items-start gap-6 w-full">
            
            {/* User Name & Email inputs */}
            <div className="self-stretch inline-flex justify-start items-center gap-5 relative -top-0.5">   
              {/* User Name */}
              <div className="flex-1 h-20 inline-flex flex-col justify-start items-start">
                <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2.5">
                  <label className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">User Name *</label>
                  <input
                    type="text"
                    placeholder="Enter user name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                    className="self-stretch flex-1 px-4 py-3 bg-white rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 text-base font-figtree text-gray-800 placeholder-gray-500 focus:outline-blue-950 focus:outline-2"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="flex-1 h-20 inline-flex flex-col justify-start items-start">
                <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-2.5">
                  <label className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">Email *</label>
                  <input
                    type="email"
                    placeholder="Enter user email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                    className="self-stretch flex-1 px-4 py-3 bg-white rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 text-base font-figtree text-gray-800 placeholder-gray-500 focus:outline-blue-950 focus:outline-2"
                  />
                </div>
              </div>
            </div>

            {/* Access Level Grid */}
            <div className="self-stretch flex flex-col justify-start items-start gap-3.5 w-full relative -top-1">
              
              {/* Select access level Header */}
              <div className="self-stretch pb-3 border-b border-gray-300 inline-flex justify-start items-center gap-6">
                <div className="flex-1 justify-start text-gray-800 text-base font-semibold font-figtree leading-[100%]">Select access level</div>
                <div className="flex justify-start items-center gap-3">
                  
                  {/* View All */}
                  <div className="w-24 flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("view")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border",
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
                  <div className="w-24 flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("edit")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border",
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
                  <div className="w-24 flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("export")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border",
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
                  <div className="w-24 flex justify-start items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleColumnAll("all")}
                      className={cn(
                        "size-4 rounded-[4px] flex items-center justify-center transition-all cursor-pointer border",
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
                      "self-stretch pb-3.5 inline-flex justify-start items-center gap-6",
                      !isLast && "border-b border-gray-300"
                    )}
                  >
                    <div className="flex-1 inline-flex flex-col justify-center items-start gap-px">
                      {row.category && (
                        <div className="self-stretch justify-start text-gray-500 text-xs font-semibold font-figtree uppercase leading-[102%] tracking-[0.05em] mb-1">
                          {row.category}
                        </div>
                      )}
                      <div className="self-stretch justify-start text-gray-800 text-base font-medium font-figtree leading-[120%]">
                        {row.label}
                      </div>
                    </div>

                    <div className="flex justify-start items-center gap-3">
                      
                      {/* View check */}
                      <div className="w-24 flex justify-start items-center gap-2">
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
                      <div className="w-24 flex justify-start items-center gap-2">
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
                      <div className="w-24 flex justify-start items-center gap-2">
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
                      <div className="w-24 flex justify-start items-center gap-2">
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
            <div className="w-[592px] max-w-full h-[82px] p-5 bg-gray-100 rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex justify-between items-center relative -top-1">
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
                userStatus === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              )}>
                {userStatus}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="self-stretch inline-flex justify-start items-start gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center overflow-hidden text-gray-800 text-lg font-normal font-figtree bg-white transition-colors cursor-pointer hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="manage-user-form"
            className="flex-1 px-6 py-4 bg-blue-950 rounded-[10px] flex justify-center items-center overflow-hidden text-white text-lg font-normal font-figtree transition-colors cursor-pointer hover:bg-blue-900"
          >
            {editingUser ? "Save Changes" : "Add Now"}
          </button>
        </div>
      </div>
    </>
  );
}
