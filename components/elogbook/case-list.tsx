"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClinicalCaseLog,
  ClinicalCaseStatus,
  AYURVEDA_DEPARTMENTS,
} from "@/lib/elogbook/types";
import {
  fetchStudentCaseLogsAction,
  deleteDraftCaseLogAction,
} from "@/app/student/elogbook/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit3,
  Trash2,
  Eye,
  Sparkles,
  ShieldAlert,
  Building2,
  Calendar,
  Tag,
  Award,
  BookOpen,
  Database,
  RefreshCw,
} from "lucide-react";

interface StatusConfig {
  label: string;
  variant: "herbal" | "saffron" | "destructive" | "parchment" | "outline" | "default";
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const STATUS_MAP: Record<ClinicalCaseStatus, StatusConfig> = {
  verified: {
    label: "Verified",
    variant: "herbal",
    icon: CheckCircle2,
    description: "Faculty approved & competency credited",
  },
  under_review: {
    label: "Under Review",
    variant: "saffron",
    icon: Clock,
    description: "Supervising faculty reviewing case",
  },
  submitted: {
    label: "Submitted",
    variant: "saffron",
    icon: Clock,
    description: "In faculty queue for evaluation",
  },
  revision_requested: {
    label: "Needs Revision",
    variant: "destructive",
    icon: AlertCircle,
    description: "Faculty feedback pending correction",
  },
  draft: {
    label: "Draft",
    variant: "parchment",
    icon: Edit3,
    description: "Work in progress by student",
  },
};

export function CaseList() {
  const router = useRouter();
  const [cases, setCases] = React.useState<ClinicalCaseLog[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [selectedDept, setSelectedDept] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTableMissing, setIsTableMissing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  const loadCases = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsTableMissing(false);

    try {
      const res = await fetchStudentCaseLogsAction();
      if (res.success && res.data) {
        setCases(res.data);
      } else {
        if (res.isTableMissing) {
          setIsTableMissing(true);
          setErrorMessage(res.error || "Database tables not yet created in Supabase.");
        } else {
          setErrorMessage(res.error || "Could not fetch case logs from Supabase.");
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while connecting to Supabase.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCases();
  }, [loadCases]);

  const showNotification = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleDelete = async (id: string, token: string) => {
    if (confirm(`Are you sure you want to delete draft case "${token}"?`)) {
      try {
        const res = await deleteDraftCaseLogAction(id);
        if (res.success) {
          showNotification(`Draft case ${token} has been deleted.`);
          loadCases();
        } else {
          alert(res.error || "Failed to delete case from database.");
        }
      } catch (err: any) {
        alert(err.message || "Failed to delete case.");
      }
    }
  };

  // Filter calculations
  const filteredCases = cases.filter((c) => {
    if (selectedStatus !== "all" && c.status !== selectedStatus) {
      return false;
    }
    if (selectedDept !== "all" && c.department !== selectedDept) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchToken = c.case_reference_token.toLowerCase().includes(q);
      const matchDiagnosis = c.provisional_diagnosis.toLowerCase().includes(q);
      const matchComplaint = c.chief_complaint.toLowerCase().includes(q);
      const matchTerm = (c.namaste_term || "").toLowerCase().includes(q);
      const matchCode = (c.namaste_code || "").toLowerCase().includes(q);
      const matchDept = c.department.toLowerCase().includes(q);
      return matchToken || matchDiagnosis || matchComplaint || matchTerm || matchCode || matchDept;
    }
    return true;
  });

  // KPI Metrics
  const totalCount = cases.length;
  const verifiedCount = cases.filter((c) => c.status === "verified").length;
  const inReviewCount = cases.filter((c) => c.status === "submitted" || c.status === "under_review").length;
  const revisionCount = cases.filter((c) => c.status === "revision_requested").length;
  const draftCount = cases.filter((c) => c.status === "draft").length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-ayush-muted space-y-3 bg-ayush-card rounded-2xl border border-ayush-border/80">
        <Clock className="w-6 h-6 animate-spin text-ayush-green" />
        <p className="text-sm font-medium">Fetching clinical case logs from Supabase...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SUPABASE PREREQUISITE WARNING IF TABLE MISSING */}
      {isTableMissing && (
        <div className="p-5 rounded-xl border border-ayush-saffron/40 bg-ayush-saffron/10 space-y-3">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-ayush-saffron mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-bold text-ayush-brown font-heading">
                Database Tables Not Configured
              </p>
              <p className="text-xs text-ayush-dark/90 leading-relaxed">
                The e-Logbook database table <code className="font-mono bg-ayush-sand px-1 py-0.5 rounded">public.clinical_case_logs</code> has not yet been created in your Supabase database. Real student persistence requires applying the prepared migration.
              </p>
              <p className="text-[11px] text-ayush-muted">
                Migration file: <code className="font-mono text-ayush-brown">supabase/migrations/20260919094830_clinical_elogbook_core.sql</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-ayush-saffron/20 pl-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadCases}
              className="text-xs text-ayush-brown hover:bg-ayush-saffron/20"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry Supabase Connection
            </Button>
          </div>
        </div>
      )}

      {/* GENERAL ERROR BANNER */}
      {errorMessage && !isTableMissing && (
        <div className="p-4 rounded-xl border border-ayush-terracotta/40 bg-ayush-terracotta/10 text-xs text-ayush-dark flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-ayush-terracotta shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadCases} className="text-xs shrink-0">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* PRIVACY & COMPLIANCE HEADER */}
      <div className="p-4 rounded-xl border border-ayush-border bg-ayush-card shadow-warm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-ayush-green mt-0.5 shrink-0" />
          <div className="text-xs text-ayush-dark/80 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ayush-brown">
                Authenticated Student e-Logbook:
              </span>
              <Badge variant="herbal" className="text-[10px]">
                Supabase Connected
              </Badge>
            </div>
            <p className="text-[11px] text-ayush-muted">
              Standardized clinical case records for Ayush clinical training. Real patient names, Aadhaar, ABHA, and hospital MRNs are strictly forbidden.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <Link href="/student/elogbook/new">
            <Button size="sm" variant="secondary" className="text-xs font-semibold shadow-warm">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record New Clinical Case
            </Button>
          </Link>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3 bg-ayush-green/15 text-ayush-green border border-ayush-green/30 rounded-lg text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          {feedbackMessage}
        </div>
      )}

      {/* KPI STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setSelectedStatus("all")}
          className={`cursor-pointer transition-all hover:shadow-warm border-ayush-border/80 ${
            selectedStatus === "all" ? "ring-2 ring-ayush-brown bg-ayush-sand/30" : "bg-ayush-card"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ayush-muted">Total Cases</p>
              <p className="text-2xl font-bold text-ayush-dark font-heading">{totalCount}</p>
            </div>
            <FileText className="w-7 h-7 text-ayush-muted/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setSelectedStatus("verified")}
          className={`cursor-pointer transition-all hover:shadow-warm border-ayush-green/30 ${
            selectedStatus === "verified" ? "ring-2 ring-ayush-green bg-ayush-green/10" : "bg-ayush-card"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ayush-green">Verified</p>
              <p className="text-2xl font-bold text-ayush-green font-heading">{verifiedCount}</p>
            </div>
            <CheckCircle2 className="w-7 h-7 text-ayush-green/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setSelectedStatus("submitted")}
          className={`cursor-pointer transition-all hover:shadow-warm border-ayush-saffron/30 ${
            selectedStatus === "submitted" || selectedStatus === "under_review"
              ? "ring-2 ring-ayush-saffron bg-ayush-saffron/10"
              : "bg-ayush-card"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ayush-saffron">In Review</p>
              <p className="text-2xl font-bold text-ayush-saffron font-heading">{inReviewCount}</p>
            </div>
            <Clock className="w-7 h-7 text-ayush-saffron/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setSelectedStatus("revision_requested")}
          className={`cursor-pointer transition-all hover:shadow-warm border-ayush-terracotta/30 ${
            selectedStatus === "revision_requested"
              ? "ring-2 ring-ayush-terracotta bg-ayush-terracotta/10"
              : "bg-ayush-card"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ayush-terracotta">Needs Revision</p>
              <p className="text-2xl font-bold text-ayush-terracotta font-heading">{revisionCount}</p>
            </div>
            <AlertCircle className="w-7 h-7 text-ayush-terracotta/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setSelectedStatus("draft")}
          className={`cursor-pointer transition-all hover:shadow-warm border-ayush-border/80 ${
            selectedStatus === "draft" ? "ring-2 ring-ayush-brown bg-ayush-sand/30" : "bg-ayush-card"
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ayush-muted">Drafts</p>
              <p className="text-2xl font-bold text-ayush-dark font-heading">{draftCount}</p>
            </div>
            <Edit3 className="w-7 h-7 text-ayush-muted/40" />
          </CardContent>
        </Card>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-ayush-card p-4 rounded-xl border border-ayush-border/80 shadow-warm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ayush-muted" />
          <input
            type="text"
            placeholder="Search by case ID, diagnosis, NAMASTE term, or complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-ayush-sand/30 border border-ayush-border/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayush-green text-ayush-dark placeholder:text-ayush-muted/70"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ayush-muted hover:text-ayush-dark"
            >
              Clear
            </button>
          )}
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-ayush-muted shrink-0" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayush-green text-ayush-dark font-medium"
          >
            <option value="all">All Departments</option>
            {AYURVEDA_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs py-2 px-3 bg-ayush-sand/30 border border-ayush-border/80 rounded-lg focus:outline-none focus:ring-2 focus:ring-ayush-green text-ayush-dark font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="revision_requested">Needs Revision</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* CASES LIST */}
      {filteredCases.length === 0 ? (
        <div className="text-center py-16 px-4 bg-ayush-card border border-ayush-border/80 rounded-2xl">
          <BookOpen className="w-12 h-12 text-ayush-muted/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-ayush-dark font-heading">No Clinical Cases Found</h3>
          <p className="text-sm text-ayush-muted max-w-md mx-auto mt-1 mb-6">
            {searchQuery || selectedStatus !== "all" || selectedDept !== "all"
              ? "No cases match your current filter criteria. Try adjusting your search query or department filter."
              : "No clinical cases yet. Create your first case log."}
          </p>
          <Link href="/student/elogbook/new">
            <Button variant="secondary" className="shadow-warm">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Your First Case Log
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCases.map((caseItem) => {
            const statusConfig = STATUS_MAP[caseItem.status] || STATUS_MAP.draft;
            const StatusIcon = statusConfig.icon;
            const isEditable = caseItem.status === "draft" || caseItem.status === "revision_requested";
            const isDraft = caseItem.status === "draft";

            return (
              <Card
                key={caseItem.id}
                className="overflow-hidden border-ayush-border/80 hover:border-ayush-green/50 hover:shadow-warm transition-all duration-200 bg-ayush-card"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Metadata & Highlights */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 bg-ayush-sand/80 text-ayush-brown rounded-md border border-ayush-border">
                        {caseItem.case_reference_token}
                      </span>

                      <Badge variant={statusConfig.variant} dot>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>

                      <Badge variant="outline" className="text-xs">
                        <Building2 className="w-3 h-3 mr-1 text-ayush-muted" />
                        {caseItem.department}
                      </Badge>

                      <span className="text-xs text-ayush-muted flex items-center gap-1 ml-auto md:ml-0">
                        <Calendar className="w-3 h-3" />
                        {caseItem.encounter_date}
                      </span>
                    </div>

                    {/* Provisional Diagnosis & Chief Complaint */}
                    <div>
                      <h4 className="text-base font-bold text-ayush-dark font-heading truncate">
                        {caseItem.provisional_diagnosis}
                      </h4>
                      <p className="text-xs text-ayush-muted/90 line-clamp-2 mt-0.5">
                        <span className="font-semibold text-ayush-dark/70">Chief Complaint:</span>{" "}
                        {caseItem.chief_complaint}
                      </p>
                    </div>

                    {/* Terminology & Competency Tags */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {caseItem.namaste_term && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ayush-green/10 text-ayush-green text-xs font-medium border border-ayush-green/20">
                          <Sparkles className="w-3 h-3" />
                          <span>{caseItem.namaste_term}</span>
                          {caseItem.namaste_code && (
                            <span className="font-mono text-[10px] text-ayush-green/80">
                              ({caseItem.namaste_code})
                            </span>
                          )}
                        </div>
                      )}

                      {caseItem.icd11_tm2_code && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ayush-saffron/10 text-ayush-saffron text-xs font-mono border border-ayush-saffron/20">
                          <Tag className="w-3 h-3" />
                          {caseItem.icd11_tm2_code}
                        </span>
                      )}

                      {caseItem.competency_ids && caseItem.competency_ids.length > 0 && (
                        <span className="text-xs text-ayush-muted flex items-center gap-1 ml-1">
                          <Award className="w-3.5 h-3.5 text-ayush-brown/60" />
                          {caseItem.competency_ids.length} Competenc{caseItem.competency_ids.length === 1 ? "y" : "ies"} Tagged
                        </span>
                      )}
                    </div>

                    {/* Faculty Feedback Snippet if verified or revision */}
                    {caseItem.faculty_feedback && (
                      <div
                        className={`p-2.5 rounded-lg text-xs border ${
                          caseItem.status === "verified"
                            ? "bg-ayush-green/10 border-ayush-green/20 text-ayush-dark"
                            : "bg-ayush-terracotta/10 border-ayush-terracotta/20 text-ayush-dark"
                        }`}
                      >
                        <span className="font-semibold text-ayush-brown">
                          {caseItem.faculty_name || "Faculty Reviewer"}:
                        </span>{" "}
                        <span className="italic">"{caseItem.faculty_feedback}"</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center md:flex-col justify-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-ayush-border/50">
                    <Link href={`/student/elogbook/${caseItem.id}`} className="w-full md:w-auto">
                      <Button variant="outline" size="sm" className="w-full text-xs font-medium">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View Detail
                      </Button>
                    </Link>

                    {isEditable && (
                      <Link href={`/student/elogbook/${caseItem.id}/edit`} className="w-full md:w-auto">
                        <Button
                          variant={caseItem.status === "revision_requested" ? "saffron" : "default"}
                          size="sm"
                          className="w-full text-xs font-medium"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                          {caseItem.status === "revision_requested" ? "Correct & Resubmit" : "Edit Draft"}
                        </Button>
                      </Link>
                    )}

                    {isDraft && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(caseItem.id, caseItem.case_reference_token)}
                        className="text-xs text-ayush-terracotta hover:bg-ayush-terracotta/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
