"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  updateInstitutionStatus,
  updateInstitutionDetails,
  VerificationStatus,
} from "@/app/super-admin/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { AddInstitutionModal } from "@/components/admin/add-institution-modal";
import {
  Building2,
  Search,
  Users,
  GraduationCap,
  MapPin,
  Loader2,
  Plus,
  ChevronDown,
  Eye,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Tag,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InstitutionRow {
  id: string;
  name: string;
  code: string | null;
  category?: string | null;
  location?: string | null;
  verification_status?: string | null;
  studentCount: number;
  facultyCount: number;
  created_at: string;
}

type ConfirmPending = {
  record: InstitutionRow;
  newStatus: VerificationStatus;
  actionLabel: string;
  confirmMessage: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  "Ayurveda Medical College",
  "National Institute of Ayurveda",
  "Ayurvedic Hospital & Research Center",
  "Ayush Deemed / State University",
  "Homoeopathy Medical College",
  "Unani Medical College",
  "Siddha Medical College",
  "Other",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function InstitutionTable({
  initialInstitutions,
}: {
  initialInstitutions: InstitutionRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Existing list/filter state (preserved) ───────────────────────────────
  const [institutions, setInstitutions] = React.useState(initialInstitutions);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  // ── New manage modal state ────────────────────────────────────────────────
  const [viewRecord, setViewRecord] = React.useState<InstitutionRow | null>(null);
  const [editRecord, setEditRecord] = React.useState<InstitutionRow | null>(null);
  const [confirmPending, setConfirmPending] = React.useState<ConfirmPending | null>(null);

  // Edit form fields
  const [editName, setEditName] = React.useState("");
  const [editCode, setEditCode] = React.useState("");
  const [editCategory, setEditCategory] = React.useState(CATEGORY_OPTIONS[0]);
  const [editLocation, setEditLocation] = React.useState("");
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────

  // Sync state with server revalidations
  React.useEffect(() => {
    setInstitutions(initialInstitutions);
  }, [initialInstitutions]);

  // Auto-open modal if navigated with ?action=add
  React.useEffect(() => {
    if (searchParams.get("action") === "add") {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  // Populate edit form whenever the selected record changes
  React.useEffect(() => {
    if (editRecord) {
      setEditName(editRecord.name);
      setEditCode(editRecord.code ?? "");
      setEditCategory(editRecord.category ?? CATEGORY_OPTIONS[0]);
      setEditLocation(editRecord.location ?? "");
      setEditError(null);
    }
  }, [editRecord]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleCreationSuccess = (created: {
    institutionName: string;
    adminEmail: string;
  }) => {
    setActionMessage({
      text: `Institution "${created.institutionName}" successfully created. Administrator login account provisioned: ${created.adminEmail}`,
      type: "success",
    });
    router.refresh();
  };

  const filtered = institutions.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(search.toLowerCase()) ||
      (inst.code && inst.code.toLowerCase().includes(search.toLowerCase())) ||
      (inst.location && inst.location.toLowerCase().includes(search.toLowerCase()));

    const status = inst.verification_status || "approved";
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  /** Open the status-change confirmation modal instead of acting immediately. */
  const handleStatusAction = (
    record: InstitutionRow,
    newStatus: VerificationStatus,
    actionLabel: string,
    confirmMessage: string
  ) => {
    setActionMessage(null);
    setConfirmPending({ record, newStatus, actionLabel, confirmMessage });
  };

  /** Called after the user confirms in the confirmation modal. */
  const executeStatusChange = async () => {
    if (!confirmPending) return;
    const { record, newStatus } = confirmPending;
    setConfirmPending(null);
    setLoadingId(record.id);
    setActionMessage(null);

    try {
      await updateInstitutionStatus(record.id, newStatus);
      setInstitutions((prev) =>
        prev.map((inst) =>
          inst.id === record.id ? { ...inst, verification_status: newStatus } : inst
        )
      );
      setActionMessage({
        text: `"${record.name}" status updated to ${newStatus}.`,
        type: "success",
      });
    } catch (err) {
      setActionMessage({
        text:
          err instanceof Error
            ? err.message
            : "Failed to update institution status.",
        type: "error",
      });
    } finally {
      setLoadingId(null);
    }
  };

  /** Save edits — validates client-side first, then calls the server action. */
  const handleEditSave = async () => {
    if (!editRecord) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("Institution name is required.");
      return;
    }
    if (trimmedName.length > 200) {
      setEditError("Institution name is too long (max 200 characters).");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await updateInstitutionDetails(editRecord.id, {
        name: trimmedName,
        code: editCode.trim() || null,
        category: editCategory,
        location: editLocation.trim() || undefined,
      });

      // Update local state after confirmed server success
      const updated: InstitutionRow = {
        ...editRecord,
        name: trimmedName,
        code: editCode.trim().toUpperCase() || null,
        category: editCategory,
        location: editLocation.trim() || editRecord.location,
      };
      setInstitutions((prev) =>
        prev.map((inst) => (inst.id === editRecord.id ? updated : inst))
      );
      setActionMessage({
        text: `"${trimmedName}" details updated successfully.`,
        type: "success",
      });
      setEditRecord(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update institution details."
      );
    } finally {
      setEditLoading(false);
    }
  };

  const getStatusBadge = (status?: string | null) => {
    const s = status || "approved";
    switch (s) {
      case "approved":
        return (
          <Badge variant="herbal" className="text-[10px] uppercase">
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="saffron" className="text-[10px] uppercase">
            Pending
          </Badge>
        );
      case "suspended":
        return (
          <Badge variant="destructive" className="text-[10px] uppercase">
            Suspended
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-[10px] uppercase">
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="default" className="text-[10px] uppercase">
            {s}
          </Badge>
        );
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Action notification */}
      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium ${
            actionMessage.type === "success"
              ? "bg-ayush-green/10 border-ayush-green/30 text-ayush-green"
              : "bg-ayush-terracotta/10 border-ayush-terracotta/30 text-ayush-terracotta"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Controls bar: Search, Status Filters & Add Institution Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-ayush-card p-4 rounded-xl border border-ayush-border/80 shadow-warm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ayush-muted" />
            <Input
              placeholder="Search by name, code, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["all", "approved", "pending", "suspended", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-ayush-brown text-ayush-card shadow-warm"
                    : "bg-ayush-sand/50 text-ayush-dark hover:bg-ayush-sand"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="h-9 text-xs bg-ayush-brown hover:bg-ayush-brown/90 text-white font-semibold gap-1.5 shadow-warm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Institution</span>
        </Button>
      </div>

      {/* Institutions table */}
      <div className="rounded-xl border border-ayush-border/80 bg-ayush-card shadow-warm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-ayush-border/80 bg-ayush-sand/40 text-ayush-dark font-heading uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Institution</th>
                <th className="p-4">Type / Location</th>
                <th className="p-4">Affiliated Scholars</th>
                <th className="p-4">Faculty</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ayush-border/60 text-ayush-dark">
              {filtered.length > 0 ? (
                filtered.map((inst) => {
                  const status = inst.verification_status || "approved";
                  const isLoading = loadingId === inst.id;

                  return (
                    <tr
                      key={inst.id}
                      className="hover:bg-ayush-sand/20 transition-colors"
                    >
                      {/* Institution name + code */}
                      <td className="p-4 font-medium">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-ayush-sand/60 text-ayush-brown shrink-0 mt-0.5">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-ayush-dark">
                              {inst.name}
                            </div>
                            <div className="text-[11px] text-ayush-muted mt-0.5">
                              Code: {inst.code || "AYUSH-INST"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type / location */}
                      <td className="p-4">
                        <div className="text-ayush-dark font-medium">
                          {inst.category || "Ayurveda College"}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-ayush-muted mt-0.5">
                          <MapPin className="w-3 h-3 text-ayush-muted shrink-0" />
                          <span>{inst.location || "India"}</span>
                        </div>
                      </td>

                      {/* Student count */}
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ayush-sand/40 text-ayush-brown font-semibold text-xs">
                          <Users className="w-3.5 h-3.5" />
                          <span>{inst.studentCount} Students</span>
                        </div>
                      </td>

                      {/* Faculty count */}
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ayush-sand/40 text-ayush-green font-semibold text-xs">
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>{inst.facultyCount} Faculty</span>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="p-4">{getStatusBadge(status)}</td>

                      {/* Manage dropdown */}
                      <td className="p-4 text-right">
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-ayush-brown ml-auto" />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-ayush-brown hover:bg-ayush-sand/60 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ayush-brown">
                              Manage
                              <ChevronDown className="w-3 h-3" />
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                              align="end"
                              className="w-52 bg-ayush-card border-ayush-border/80 shadow-warm"
                            >
                              {/* Record label */}
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold px-2 py-1.5">
                                {inst.name.length > 26
                                  ? inst.name.slice(0, 26) + "…"
                                  : inst.name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-ayush-border/60" />

                              {/* View Details */}
                              <DropdownMenuItem
                                className="cursor-pointer text-[12px] text-ayush-dark gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                onClick={() => setViewRecord(inst)}
                              >
                                <Eye className="w-3.5 h-3.5 text-ayush-muted" />
                                View Details
                              </DropdownMenuItem>

                              {/* Edit */}
                              <DropdownMenuItem
                                className="cursor-pointer text-[12px] text-ayush-brown gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                onClick={() => setEditRecord(inst)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit Institution
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-ayush-border/60" />

                              {/* Approve — pending or rejected */}
                              {(status === "pending" || status === "rejected") && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-[12px] text-ayush-green gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                  onClick={() =>
                                    handleStatusAction(
                                      inst,
                                      "approved",
                                      "Approve",
                                      `This will mark "${inst.name}" as approved and allow it to participate on the platform.`
                                    )
                                  }
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Approve
                                </DropdownMenuItem>
                              )}

                              {/* Activate — suspended only */}
                              {status === "suspended" && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-[12px] text-ayush-green gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                  onClick={() =>
                                    handleStatusAction(
                                      inst,
                                      "approved",
                                      "Activate",
                                      `This will restore "${inst.name}" to approved status, re-enabling platform access for its users. Student and faculty data is fully preserved.`
                                    )
                                  }
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Activate
                                </DropdownMenuItem>
                              )}

                              {/* Suspend — approved only */}
                              {status === "approved" && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-[12px] text-amber-700 gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                  onClick={() =>
                                    handleStatusAction(
                                      inst,
                                      "suspended",
                                      "Suspend",
                                      `This will suspend "${inst.name}". Associated users will lose active access. All student, faculty, and data records are preserved and the institution can be restored later.`
                                    )
                                  }
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Suspend
                                </DropdownMenuItem>
                              )}

                              {/* Reject — any status except already rejected */}
                              {status !== "rejected" && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-[12px] text-ayush-terracotta gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                  onClick={() =>
                                    handleStatusAction(
                                      inst,
                                      "rejected",
                                      "Reject",
                                      `This will mark "${inst.name}" as rejected. The record is retained in the system and can be updated or re-approved later.`
                                    )
                                  }
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-xs text-ayush-muted"
                  >
                    No institutions found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Institution Modal (unchanged) ──────────────────────────────── */}
      <AddInstitutionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleCreationSuccess}
      />

      {/* ── View Details Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!viewRecord}
        onClose={() => setViewRecord(null)}
        title="Institution Details"
        description="Read-only record from the platform database."
        maxWidth="md"
      >
        {viewRecord && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Full-width: Name */}
              <div className="col-span-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold">
                  Institution Name
                </p>
                <p className="text-sm font-semibold text-ayush-dark">
                  {viewRecord.name}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Code
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.code || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold">
                  Status
                </p>
                {getStatusBadge(viewRecord.verification_status)}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold">
                  Category
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.category || "Ayurveda College"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.location || "India"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold flex items-center gap-1">
                  <Users className="w-3 h-3" /> Affiliated Students
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.studentCount}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> Faculty Members
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.facultyCount}
                </p>
              </div>

              <div className="col-span-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Registered
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {new Date(viewRecord.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ayush-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setViewRecord(null);
                  setEditRecord(viewRecord);
                }}
                className="h-8 text-xs text-ayush-brown"
              >
                <Pencil className="w-3 h-3 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewRecord(null)}
                className="h-8 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editRecord}
        onClose={() => {
          setEditRecord(null);
          setEditError(null);
        }}
        title="Edit Institution"
        description="Update institution information. Changes take effect immediately."
        maxWidth="md"
      >
        {editRecord && (
          <div className="space-y-4">
            {editError && (
              <div className="p-3 rounded-lg border border-ayush-terracotta/30 bg-ayush-terracotta/10 text-ayush-terracotta text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-inst-name"
                  className="text-xs font-semibold text-ayush-dark"
                >
                  Institution Name{" "}
                  <span className="text-ayush-terracotta">*</span>
                </Label>
                <Input
                  id="edit-inst-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={editLoading}
                  className="h-9 text-xs"
                  placeholder="Institution name"
                />
              </div>

              {/* Code + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-inst-code"
                    className="text-xs font-semibold text-ayush-dark"
                  >
                    Institution Code
                  </Label>
                  <Input
                    id="edit-inst-code"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    disabled={editLoading}
                    className="h-9 text-xs"
                    placeholder="e.g. GAMC-BLR"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-inst-category"
                    className="text-xs font-semibold text-ayush-dark"
                  >
                    Category
                  </Label>
                  <select
                    id="edit-inst-category"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={editLoading}
                    className="w-full h-9 rounded-md border border-ayush-border/80 bg-ayush-card px-3 text-xs text-ayush-dark focus:outline-none focus:ring-1 focus:ring-ayush-brown"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-inst-location"
                  className="text-xs font-semibold text-ayush-dark"
                >
                  Location
                </Label>
                <Input
                  id="edit-inst-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  disabled={editLoading}
                  className="h-9 text-xs"
                  placeholder="e.g. Bengaluru, Karnataka"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-ayush-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditRecord(null);
                  setEditError(null);
                }}
                disabled={editLoading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEditSave}
                disabled={editLoading}
                className="h-8 text-xs bg-ayush-brown hover:bg-ayush-brown/90 text-white font-semibold px-4 shadow-warm"
              >
                {editLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Status Confirmation Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={!!confirmPending}
        onClose={() => setConfirmPending(null)}
        title={confirmPending ? `Confirm: ${confirmPending.actionLabel}` : "Confirm"}
        maxWidth="sm"
      >
        {confirmPending && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-ayush-sand/40 border border-ayush-border/60">
              <AlertTriangle className="w-4 h-4 text-ayush-saffron shrink-0 mt-0.5" />
              <p className="text-xs text-ayush-dark leading-relaxed">
                {confirmPending.confirmMessage}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmPending(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={executeStatusChange}
                className={`h-8 text-xs font-semibold text-white px-5 ${
                  confirmPending.newStatus === "approved"
                    ? "bg-ayush-green hover:bg-ayush-green/90"
                    : confirmPending.newStatus === "rejected"
                    ? "bg-ayush-terracotta hover:bg-ayush-terracotta/90"
                    : "bg-amber-700 hover:bg-amber-800"
                }`}
              >
                {confirmPending.actionLabel}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
