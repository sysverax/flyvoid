"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Search, Plus, Trash2 } from "lucide-react";
import { cn, sortData } from "@/src/lib/utils";
import { Toast } from "@/src/types/common";
import { ToastList } from "@/src/components/ui/ToastList";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortHeader } from "@/src/components/ui/table";
import { ManageUserModal } from "@/src/components/manage-users/ManageUserModal";
import { useAuth } from "@/src/hooks/useAuth";

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

const defaultSarahPermissions: UserPermissions = {
  dashboard: { view: true, edit: true, export: true, all: true },
  airlines: { view: true, edit: true, export: true, all: true },
  cancelledFlights: { view: false, edit: false, export: false, all: false },
  platformOverview: { view: true, edit: true, export: true, all: true },
  detailedAnalysis: { view: true, edit: true, export: true, all: true },
  platformTreasury: { view: false, edit: false, export: false, all: false },
  invitesOnboarding: { view: false, edit: false, export: false, all: false },
  systemSettings: { view: true, edit: true, export: true, all: true },
  auditLogs: { view: true, edit: true, export: true, all: true },
};

const defaultDavidPermissions: UserPermissions = {
  dashboard: { view: true, edit: true, export: false, all: false },
  airlines: { view: true, edit: false, export: false, all: false },
  cancelledFlights: { view: true, edit: false, export: false, all: false },
  platformOverview: { view: true, edit: false, export: false, all: false },
  detailedAnalysis: { view: true, edit: false, export: false, all: false },
  platformTreasury: { view: false, edit: false, export: false, all: false },
  invitesOnboarding: { view: true, edit: true, export: false, all: false },
  systemSettings: { view: false, edit: false, export: false, all: false },
  auditLogs: { view: true, edit: false, export: false, all: false },
};

const defaultMayaPermissions: UserPermissions = {
  dashboard: { view: true, edit: false, export: false, all: false },
  airlines: { view: true, edit: false, export: false, all: false },
  cancelledFlights: { view: true, edit: false, export: false, all: false },
  platformOverview: { view: false, edit: false, export: false, all: false },
  detailedAnalysis: { view: false, edit: false, export: false, all: false },
  platformTreasury: { view: false, edit: false, export: false, all: false },
  invitesOnboarding: { view: false, edit: false, export: false, all: false },
  systemSettings: { view: false, edit: false, export: false, all: false },
  auditLogs: { view: true, edit: false, export: false, all: false },
};

export default function ManageUsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([
    {
      id: "AID0001",
      name: "Sarah Johnson",
      email: "sarah@flyvoid.com",
      status: "Active",
      permissions: defaultSarahPermissions,
    },
    {
      id: "AID0002",
      name: "David Chen",
      email: "david@flyvoid.com",
      status: "Active",
      permissions: defaultDavidPermissions,
    },
    {
      id: "AID0003",
      name: "Maya Patel",
      email: "maya@flyvoid.com",
      status: "Inactive",
      permissions: defaultMayaPermissions,
    },
  ]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast("User deleted successfully.", "info");
    }
  };

  const handleSaveUser = (
    name: string,
    email: string,
    status: "Active" | "Inactive",
    permissions: UserPermissions
  ) => {
    if (!name.trim() || !email.trim()) {
      showToast("Please fill in all required fields.", "warning");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast("Please enter a valid email address.", "warning");
      return;
    }

    if (editingUser) {
      // Edit mode
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name, email, status, permissions }
            : u
        )
      );
      showToast("User updated successfully!", "success");
    } else {
      // Add mode
      const newId = `AID${String(users.length + 1).padStart(4, "0")}`;
      const newUser: User = {
        id: newId,
        name,
        email,
        status,
        permissions,
      };
      setUsers((prev) => [...prev, newUser]);
      showToast("New user added successfully!", "success");
    }

    setIsModalOpen(false);
  };

  // Sorting States
  const [sortField, setSortField] = useState<keyof User | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Search and status filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        u.id.toLowerCase().includes(query) ||
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "All" || u.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  // Sort Data
  const sortedUsers = useMemo(() => {
    return sortData(filteredUsers, sortField, sortOrder, []);
  }, [filteredUsers, sortField, sortOrder]);

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {/* Header Section */}
      <div className="mb-7 flex flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%] font-figtree">
            Manage Users
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1 font-figtree">
            Create and manage admin users and their module access
          </p>
        </div>
        {hasPermission("edit") && (
          <Button
            onClick={handleOpenAddModal}
            className="h-[50px] rounded-[10px] bg-primary hover:bg-primary-hover px-4.5 py-[9px] text-[16px] font-medium font-figtree transition-colors duration-200 cursor-pointer text-white flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span>Add New</span>
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="h-[88px] mb-6 flex flex-col sm:flex-row gap-4 w-full bg-white p-4 rounded-xl border border-gray-200 justify-between items-center -mt-1">
        <div className="relative w-full sm:max-w-[520px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4.5 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search by User ID, Name, Email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[48px] pl-[46px] pr-4 border border-[#D1D5DB] bg-[#F3F4F6] rounded-[10px] text-[16px] font-figtree focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all text-gray-800 placeholder-[#6B7280]"
          />
        </div>

        <Dropdown
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as any)}
          options={[
            { value: "All", label: "All Status" },
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" },
          ]}
          triggerWidthClass="w-full sm:w-[180px]"
          widthClass="w-[180px]"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">
                <SortHeader label="User ID" field="id" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              <TableHead className="min-w-[413.5px]">
                <SortHeader label="Name" field="name" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              <TableHead className="min-w-[413.5px]">
                <SortHeader label="Email" field="email" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              <TableHead className="min-w-[100px]">
                <SortHeader label="Status" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              {hasPermission("edit") && <TableHead className="min-w-[89px]">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length > 0 ? (
              sortedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <TableCell className="font-mono font-medium text-gray-600">{user.id}</TableCell>
                  <TableCell className="font-medium text-[#1F2937]">{user.name}</TableCell>
                  <TableCell className="text-[#6B7280]">{user.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  {hasPermission("edit") && (
                    <TableCell>
                      <div className="flex items-center justify-start gap-2.5">
                        <Button
                          variant="ghost"
                          className="h-5 w-5 cursor-pointer p-0"
                          size="icon"
                          onClick={() => handleOpenEditModal(user)}
                          title="Edit User"
                        >
                          <Image
                            src="/icons/edit.svg"
                            alt="Edit"
                            width={20}
                            height={20}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-5 w-5 cursor-pointer p-0"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Delete User"
                        >
                          <Trash2 className="h-5 w-5 text-[#6B7280] hover:text-rose-600 transition-colors" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={hasPermission("edit") ? 5 : 4} className="px-6 py-10 text-center text-gray-500 font-figtree">
                  No users found matching your search filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ManageUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />

      {/* Global Toast list */}
      <ToastList toasts={toasts} />
    </div>
  );
}
