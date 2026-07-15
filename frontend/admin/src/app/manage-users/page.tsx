"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { cn, sortData } from "@/src/lib/utils";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Button } from "@/src/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortHeader } from "@/src/components/ui/table";
import { ManageUserModal } from "@/src/components/manage-users/ManageUserModal";
import { DeleteUserDialog } from "@/src/components/manage-users/DeleteUserDialog";
import { useAuth } from "@/src/hooks/useAuth";
import { Pagination } from "@/src/components/ui/pagination";
import { usersService, User } from "@/src/services/users.service";
import { toast } from "react-toastify";

export default function ManageUsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [totalResults, setTotalResults] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isEditingId, setIsEditingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  const fetchUsers = async (page = currentPage, limit = resultsPerPage) => {
    setIsLoading(true);
    try {
      const res = await usersService.getUsers(page, limit);
      setUsers(res.users);
      setTotalResults(res.total);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentPage, resultsPerPage);
  }, [currentPage, resultsPerPage]);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setIsEditingId(user.id);
    setTimeout(() => {
      setEditingUser(user);
      setIsModalOpen(true);
      setIsEditingId(null);
    }, 400);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const message = await usersService.deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.success(message);
      setDeleteTarget(null);

      if (users.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        fetchUsers(currentPage, resultsPerPage);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveUser = async (
    firstName: string,
    lastName: string,
    email: string,
    isActive: boolean,
    accessControls: Array<{ asset: string; access: string[] }>
  ) => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.warn("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warn("Please enter a valid email address");
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        // Edit mode
        const { user: updatedUser, message } = await usersService.updateUser(editingUser.id, {
          firstName,
          lastName,
          email,
          isActive,
          accessControls,
        });

        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? updatedUser : u))
        );
        toast.success(message);
      } else {
        // Add mode
        const { user: invitedUser, message, temporaryPassword } = await usersService.inviteUser({
          firstName,
          lastName,
          email,
          isActive,
          accessControls,
        });

        fetchUsers(currentPage, resultsPerPage);
        toast.success(message);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save user.");
    } finally {
      setIsSaving(false);
    }
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
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      const matchesSearch =
        String(u.id).toLowerCase().includes(query) ||
        name.includes(query) ||
        u.email.toLowerCase().includes(query);

      const status = u.isActive ? "Active" : "Inactive";
      const matchesStatus = statusFilter === "All" || status === statusFilter;

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
            className="h-[50px] bg-primary hover:bg-primary-hover px-4.5 py-[9px] text-[16px] font-medium font-figtree transition-colors duration-200 cursor-pointer text-white flex items-center justify-center gap-2"
            style={{ borderRadius: "10px" }}
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
                <SortHeader label="Name" field="firstName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              <TableHead className="min-w-[413.5px]">
                <SortHeader label="Email" field="email" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              <TableHead className="min-w-[100px]">
                <SortHeader label="Status" field="isActive" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
              </TableHead>
              {hasPermission("edit") && <TableHead className="min-w-[89px]">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={hasPermission("edit") ? 5 : 4} className="px-6 py-12 text-center text-gray-500 font-figtree">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading users...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedUsers.length > 0 ? (
              sortedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <TableCell className="font-mono font-medium text-gray-600">{user.id}</TableCell>
                  <TableCell className="font-medium text-[#1F2937]">{`${user.firstName} ${user.lastName}`}</TableCell>
                  <TableCell className="text-[#6B7280]">{user.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.isActive ? "Active" : "Inactive"} />
                  </TableCell>
                  {hasPermission("edit") && (
                    <TableCell>
                      <div className="flex items-center justify-start gap-2.5">
                        <Button
                          variant="ghost"
                          className="h-5 w-5 cursor-pointer p-0 hover:bg-transparent"
                          size="icon"
                          onClick={() => handleOpenEditModal(user)}
                          disabled={isEditingId === user.id}
                        >
                          {isEditingId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                          ) : (
                            <Image
                              src="/icons/edit.svg"
                              alt="Edit"
                              width={20}
                              height={20}
                            />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-5 w-5 cursor-pointer p-0 hover:bg-transparent"
                          size="icon"
                          onClick={() => setDeleteTarget(user)}
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

      {totalResults > 0 && (
        <div className="mb-6">
          <Pagination
            totalResults={totalResults}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            resultsPerPage={resultsPerPage}
            setResultsPerPage={setResultsPerPage}
            totalPages={totalPages}
          />
        </div>
      )}

      <ManageUserModal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        onSave={handleSaveUser}
        editingUser={editingUser}
        isLoading={isSaving}
      />

      <DeleteUserDialog
        isOpen={!!deleteTarget}
        user={deleteTarget}
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
