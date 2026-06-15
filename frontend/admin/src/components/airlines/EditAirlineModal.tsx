"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { Airline } from "@/src/types/airlines";

interface EditAirlineModalProps {
  airline: Airline;
  onClose: () => void;
  onSave: (updatedFields: Partial<Airline>) => void;
}

export function EditAirlineModal({
  airline,
  onClose,
  onSave,
}: EditAirlineModalProps) {
  const [editFormState, setEditFormState] = useState({
    airlineName: airline.airlineName,
    airlineCode: airline.airlineCode,
    country: airline.country,
    companyReg: airline.companyReg,
    website: airline.website,
    contactEmail: airline.contactEmail,
    contactPhone: airline.contactPhone,
    timezone: airline.timezone,
    currency: airline.currency,
    address: airline.address,
    logoUrl: airline.logoUrl || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editFormState);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div className="relative w-full max-w-2xl rounded-[16px] bg-white p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-[20px] font-bold text-[#1F2937]">Edit Airline Details</h3>
        <p className="text-[13px] text-[#6B7280] mt-1 mb-6">Update airline & admin information.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h4 className="text-[14px] font-bold text-[#1F2937] border-b border-gray-100 pb-2 mb-4">Airline Details</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-[14px]">
              {/* Airline Name */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Airline Name *</label>
                <input
                  type="text"
                  required
                  value={editFormState.airlineName}
                  onChange={(e) => setEditFormState({ ...editFormState, airlineName: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                />
              </div>

              {/* Airline Code */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Airline Code *</label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={editFormState.airlineCode}
                  onChange={(e) => setEditFormState({ ...editFormState, airlineCode: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium uppercase"
                />
              </div>

              {/* Country */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Country *</label>
                <div className="relative">
                  <select
                    value={editFormState.country}
                    onChange={(e) => setEditFormState({ ...editFormState, country: e.target.value })}
                    className="h-10 w-full appearance-none rounded-[8px] border border-gray-200 pl-3 pr-8 outline-none focus:border-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="France">France</option>
                    <option value="Germany">Germany</option>
                    <option value="Japan">Japan</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Company Reg Number */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Company Registration Number *</label>
                <input
                  type="text"
                  required
                  value={editFormState.companyReg}
                  onChange={(e) => setEditFormState({ ...editFormState, companyReg: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                />
              </div>

              {/* Website */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Website</label>
                <input
                  type="url"
                  value={editFormState.website}
                  onChange={(e) => setEditFormState({ ...editFormState, website: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                  placeholder="https://..."
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Contact Email *</label>
                <input
                  type="email"
                  required
                  value={editFormState.contactEmail}
                  onChange={(e) => setEditFormState({ ...editFormState, contactEmail: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={editFormState.contactPhone}
                  onChange={(e) => setEditFormState({ ...editFormState, contactPhone: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                />
              </div>

              {/* Timezone */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Timezone *</label>
                <div className="relative">
                  <select
                    value={editFormState.timezone}
                    onChange={(e) => setEditFormState({ ...editFormState, timezone: e.target.value })}
                    className="h-10 w-full appearance-none rounded-[8px] border border-gray-200 pl-3 pr-8 outline-none focus:border-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="UTC">UTC</option>
                    <option value="EST">EST</option>
                    <option value="CST">CST</option>
                    <option value="PST">PST</option>
                    <option value="GMT">GMT</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Logo URL */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Logo URL</label>
                <input
                  type="text"
                  value={editFormState.logoUrl}
                  onChange={(e) => setEditFormState({ ...editFormState, logoUrl: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                  placeholder="https://..."
                />
              </div>

              {/* Currency */}
              <div className="space-y-1">
                <label className="font-semibold text-gray-700">Currency *</label>
                <div className="relative">
                  <select
                    value={editFormState.currency}
                    onChange={(e) => setEditFormState({ ...editFormState, currency: e.target.value })}
                    className="h-10 w-full appearance-none rounded-[8px] border border-gray-200 pl-3 pr-8 outline-none focus:border-primary transition-all font-medium cursor-pointer"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-gray-700">Address *</label>
                <input
                  type="text"
                  required
                  value={editFormState.address}
                  onChange={(e) => setEditFormState({ ...editFormState, address: e.target.value })}
                  className="h-10 w-full rounded-[8px] border border-gray-200 px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-[8px] border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-11 rounded-[8px] bg-[#0F2757] px-6 text-sm font-semibold text-white hover:bg-[#1A3B75] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
