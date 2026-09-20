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
  updateOrganizationStatus,
  updateOrganizationDetails,
  VerificationStatus,
} from "@/app/super-admin/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { AddIndustryModal } from "@/components/admin/add-industry-modal";
import {
  Briefcase,
  Search,
  Compass,
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
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrganizationRow {
  id: string;
  name: string;
  organization_type?: string | null;
  location?: string | null;
  verification_status?: string | null;
  opportunityCount: number;
  created_at: string;
}

type ConfirmPending = {
  record: OrganizationRow;
  newStatus: VerificationStatus;
  actionLabel: string;
  confirmMessage: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ORGANIZATION_TYPE_OPTIONS = [
  "Pharmaceutical / Healthcare",
  "Clinical Research Organization (CRO)",
  "Herbal & Nutraceuticals",
  "Ayush Wellness & Hospitals",
  "Cosmeceuticals & Personal Care",
  "Herbal Cultivation & Supply Chain",
  "Other",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function IndustryTable({
  initialOrganizations,
}: {
  initialOrganizations: OrganizationRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Existing list/filter state (preserved) ───────────────────────────────
  const [organizations, setOrganizations] = React.useState(initialOrganizations);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  // ── New manage modal state ────────────────────────────────────────────────
  const [viewRecord, setViewRecord] = React.useState<OrganizationRow | null>(null);
  const [editRecord, setEditRecord] = React.useState<OrganizationRow | null>(null);
  const [confirmPending, setConfirmPending] = React.useState<ConfirmPending | null>(null);

  // Edit form fields
  const [editName, setEditName] = React.useState("");
  const [editOrgType, setEditOrgType] = React.useState(ORGANIZATION_TYPE_OPTIONS[0]);
  const [editLocation, setEditLocation] = React.useState("");
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────

  // Sync state with server revalidations
  React.useEffect(() => {
    setOrganizations(initialOrganizations);
  }, [initialOrganizations]);

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
      setEditOrgType(editRecord.organization_type ?? ORGANIZATION_TYPE_OPTIONS[0]);
      setEditLocation(editRecord.location ?? "");
      setEditError(null);
    }
  }, [editRecord]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleCreationSuccess = (created: {
    organizationName: string;
    contactEmail: string;
  }) => {
    setActionMessage({
      text: `Industry "${created.organizationName}" successfully created. Partner contact account provisioned: ${created.contactEmail}`,
      type: "success",
    });
    router.refresh();
  };

  const filtered = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      (org.organization_type &&
        org.organization_type.toLowerCase().includes(search.toLowerCase())) ||
      (org.location && org.location.toLowerCase().includes(search.toLowerCase()));

    const status = org.verification_status || "approved";
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  /** Open the status-change confirmation modal instead of acting immediately. */
  const handleStatusAction = (
    record: OrganizationRow,
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
      await updateOrganizationStatus(record.id, newStatus);
      setOrganizations((prev) =>
        prev.map((org) =>
          org.id === record.id ? { ...org, verification_status: newStatus } : org
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
            : "Failed to update organization status.",
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
      setEditError("Organization name is required.");
      return;
    }
    if (trimmedName.length > 200) {
      setEditError("Organization name is too long (max 200 characters).");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await updateOrganizationDetails(editRecord.id, {
        name: trimmedName,
        organization_type: editOrgType,
        location: editLocation.trim() || undefined,
      });

      // Update local state after confirmed server success
      const updated: OrganizationRow = {
        ...editRecord,
        name: trimmedName,
        organization_type: editOrgType,
        location: editLocation.trim() || editRecord.location,
      };
      setOrganizations((prev) =>
        prev.map((org) => (org.id === editRecord.id ? updated : org))
      );
      setActionMessage({
        text: `"${trimmedName}" details updated successfully.`,
        type: "success",
      });
      setEditRecord(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update organization details."
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

      {/* Controls bar: Search, Status Filters & Add Industry Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-ayush-card p-4 rounded-xl border border-ayush-border/80 shadow-warm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ayush-muted" />
            <Input
              placeholder="Search by name, type, location..."
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
          className="h-9 text-xs bg-ayush-green hover:bg-ayush-green/90 text-white font-semibold gap-1.5 shadow-warm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Industry</span>
        </Button>
      </div>

      {/* Organizations table */}
      <div className="rounded-xl border border-ayush-border/80 bg-ayush-card shadow-warm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-ayush-border/80 bg-ayush-sand/40 text-ayush-dark font-heading uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Industry / Organization</th>
                <th className="p-4">Type</th>
                <th className="p-4">Location</th>
                <th className="p-4">Opportunities</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ayush-border/60 text-ayush-dark">
              {filtered.length > 0 ? (
                filtered.map((org) => {
                  const status = org.verification_status || "approved";
                  const isLoading = loadingId === org.id;

                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-ayush-sand/20 transition-colors"
                    >
                      {/* Organization name + id */}
                      <td className="p-4 font-medium">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-ayush-sand/60 text-ayush-green shrink-0 mt-0.5">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-ayush-dark">
                              {org.name}
                            </div>
                            <div className="text-[11px] text-ayush-muted mt-0.5">
                              ID: {org.id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-4">
                        <span className="capitalize font-medium text-ayush-dark">
                          {org.organization_type || "Pharmaceutical / Clinical"}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-[11px] text-ayush-muted">
                          <MapPin className="w-3 h-3 text-ayush-muted shrink-0" />
                          <span>{org.location || "India"}</span>
                        </div>
                      </td>

                      {/* Opportunities */}
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ayush-sand/40 text-ayush-brown font-semibold text-xs">
                          <Compass className="w-3.5 h-3.5" />
                          <span>{org.opportunityCount} Listed</span>
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
                            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-ayush-green hover:bg-ayush-sand/60 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ayush-green">
                              Manage
                              <ChevronDown className="w-3 h-3" />
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                              align="end"
                              className="w-52 bg-ayush-card border-ayush-border/80 shadow-warm"
                            >
                              {/* Record label */}
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold px-2 py-1.5">
                                {org.name.length > 26
                                  ? org.name.slice(0, 26) + "…"
                                  : org.name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-ayush-border/60" />

                              {/* View Details */}
                              <DropdownMenuItem
                                className="cursor-pointer text-[12px] text-ayush-dark gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                onClick={() => setViewRecord(org)}
                              >
                                <Eye className="w-3.5 h-3.5 text-ayush-muted" />
                                View Details
                              </DropdownMenuItem>

                              {/* Edit */}
                              <DropdownMenuItem
                                className="cursor-pointer text-[12px] text-ayush-green gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                onClick={() => setEditRecord(org)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit Industry
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-ayush-border/60" />

                              {/* Approve — pending or rejected */}
                              {(status === "pending" || status === "rejected") && (
                                <DropdownMenuItem
                                  className="cursor-pointer text-[12px] text-ayush-green gap-2 focus:bg-ayush-sand/60 focus:text-ayush-dark"
                                  onClick={() =>
                                    handleStatusAction(
                                      org,
                                      "approved",
                                      "Approve",
                                      `This will mark "${org.name}" as approved and allow it to participate on the platform.`
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
                                      org,
                                      "approved",
                                      "Activate",
                                      `This will restore "${org.name}" to approved status, re-enabling platform access and opportunity listings for this partner.`
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
                                      org,
                                      "suspended",
                                      "Suspend",
                                      `This will suspend "${org.name}". Their opportunity listings will no longer be active. All partner data is preserved and the record can be restored at any time.`
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
                                      org,
                                      "rejected",
                                      "Reject",
                                      `This will mark "${org.name}" as rejected. The record is retained in the system and can be updated or re-approved later.`
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
                    No organizations found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Industry Modal (unchanged) ─────────────────────────────────── */}
      <AddIndustryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleCreationSuccess}
      />

      {/* ── View Details Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={!!viewRecord}
        onClose={() => setViewRecord(null)}
        title="Industry Details"
        description="Read-only record from the platform database."
        maxWidth="md"
      >
        {viewRecord && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Full-width: Name */}
              <div className="col-span-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-ayush-muted font-semibold">
                  Organization Name
                </p>
                <p className="text-sm font-semibold text-ayush-dark">
                  {viewRecord.name}
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
                  Organization Type
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.organization_type || "Pharmaceutical / Healthcare"}
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
                  <Compass className="w-3 h-3" /> Opportunities Listed
                </p>
                <p className="text-xs font-medium text-ayush-dark">
                  {viewRecord.opportunityCount}
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
                className="h-8 text-xs text-ayush-green"
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
        title="Edit Industry"
        description="Update industry / organization information. Changes take effect immediately."
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
                  htmlFor="edit-org-name"
                  className="text-xs font-semibold text-ayush-dark"
                >
                  Organization Name{" "}
                  <span className="text-ayush-terracotta">*</span>
                </Label>
                <Input
                  id="edit-org-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={editLoading}
                  className="h-9 text-xs"
                  placeholder="Organization name"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-org-type"
                  className="text-xs font-semibold text-ayush-dark"
                >
                  Organization Type
                </Label>
                <select
                  id="edit-org-type"
                  value={editOrgType}
                  onChange={(e) => setEditOrgType(e.target.value)}
                  disabled={editLoading}
                  className="w-full h-9 rounded-md border border-ayush-border/80 bg-ayush-card px-3 text-xs text-ayush-dark focus:outline-none focus:ring-1 focus:ring-ayush-green"
                >
                  {ORGANIZATION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-org-location"
                  className="text-xs font-semibold text-ayush-dark"
                >
                  Location
                </Label>
                <Input
                  id="edit-org-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  disabled={editLoading}
                  className="h-9 text-xs"
                  placeholder="e.g. Mumbai, Maharashtra"
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
                className="h-8 text-xs bg-ayush-green hover:bg-ayush-green/90 text-white font-semibold px-4 shadow-warm"
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
