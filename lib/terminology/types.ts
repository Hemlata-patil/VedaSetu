/**
 * NAMASTE e-Logbook Phase 1: Terminology Domain Types
 * Defines the contract for local sample terminology datasets, search parameters,
 * and category filtering.
 *
 * NOTE: All data structures in Phase 1 use sample codes prefixed with "SAMPLE-".
 * These are demonstration records only and must be replaced with authorized,
 * verified datasets prior to production deployment.
 */

export type TerminologyCategory =
  | "disease"
  | "symptom"
  | "pariksha"
  | "procedure"
  | "formulation";

export interface SampleTerminologyItem {
  id: string;
  term: string;
  transliteration?: string;
  alternative_terms: string[];
  category: TerminologyCategory;
  clinical_domain?: string;
  description: string;
  code: string;
  source: "sample" | string;
  verification_status: "sample_demonstration" | "verified_official";
  disclaimer: string;
}

export interface TerminologySearchParams {
  query?: string;
  category?: TerminologyCategory | "all";
}

export interface CategoryMetadata {
  key: TerminologyCategory | "all";
  label: string;
  shortLabel: string;
  badgeVariant: "herbal" | "saffron" | "parchment" | "destructive" | "default" | "secondary" | "outline";
}

export const TERMINOLOGY_CATEGORIES: CategoryMetadata[] = [
  {
    key: "all",
    label: "All Categories",
    shortLabel: "All",
    badgeVariant: "default",
  },
  {
    key: "disease",
    label: "Diseases & Pathologies (Roga / Vyādhi)",
    shortLabel: "Disease",
    badgeVariant: "saffron",
  },
  {
    key: "symptom",
    label: "Symptoms & Clinical Signs (Lakṣaṇa)",
    shortLabel: "Symptom",
    badgeVariant: "destructive",
  },
  {
    key: "pariksha",
    label: "Diagnostic Examinations (Parīkṣā)",
    shortLabel: "Examination",
    badgeVariant: "herbal",
  },
  {
    key: "procedure",
    label: "Procedures & Panchakarma (Kriyā / Karma)",
    shortLabel: "Procedure",
    badgeVariant: "parchment",
  },
  {
    key: "formulation",
    label: "Classical Formulations (Yoga / Kalpanā)",
    shortLabel: "Formulation",
    badgeVariant: "secondary",
  },
];
