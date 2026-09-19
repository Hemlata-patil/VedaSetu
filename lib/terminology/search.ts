import { SampleTerminologyItem, TerminologySearchParams } from "./types";
import sampleCatalog from "@/data/terminology/namaste-sample-catalog.json";

/**
 * Normalizes diacritical marks from transliterated Sanskrit/Ayush text
 * (e.g., 'Āmavāta' -> 'Amavata', 'Śotha' -> 'Shotha' / 'Sotha', 'Daurbalya' -> 'Daurbalya').
 */
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Reusable Terminology Search Engine for NAMASTE e-Logbook Phase 1.
 *
 * Capabilities:
 * - Searches across primary term, transliteration, alternative terms, description, and sample code.
 * - Strict case-insensitivity with whitespace trimming.
 * - Handles diacritic normalization for Sanskrit phonetic variations.
 * - Category-based filtering ('all', 'disease', 'symptom', 'pariksha', 'procedure', 'formulation').
 * - Gracefully returns all category items when search query is empty.
 */
export function searchTerminology(
  params: TerminologySearchParams = {},
  catalog: SampleTerminologyItem[] = sampleCatalog as SampleTerminologyItem[]
): SampleTerminologyItem[] {
  const { query = "", category = "all" } = params;
  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(rawQuery);

  return catalog.filter((item) => {
    // 1. Category Filter Check
    if (category && category !== "all") {
      if (item.category !== category) {
        return false;
      }
    }

    // 2. If query is empty, return all matching category items
    if (!normalizedQuery) {
      return true;
    }

    // 3. Normalized Term Match
    const normalizedTerm = normalizeText(item.term);
    if (normalizedTerm.includes(normalizedQuery)) {
      return true;
    }

    // 4. Normalized Transliteration Match
    if (item.transliteration) {
      const normalizedTranslit = normalizeText(item.transliteration);
      if (normalizedTranslit.includes(normalizedQuery)) {
        return true;
      }
    }

    // 5. Normalized Alternative Terms Match
    if (item.alternative_terms && Array.isArray(item.alternative_terms)) {
      const hasAlternativeMatch = item.alternative_terms.some((alt) =>
        normalizeText(alt).includes(normalizedQuery)
      );
      if (hasAlternativeMatch) {
        return true;
      }
    }

    // 6. Code Match
    if (item.code && normalizeText(item.code).includes(normalizedQuery)) {
      return true;
    }

    // 7. Description / Domain Match
    if (item.description && normalizeText(item.description).includes(normalizedQuery)) {
      return true;
    }
    if (item.clinical_domain && normalizeText(item.clinical_domain).includes(normalizedQuery)) {
      return true;
    }

    return false;
  });
}

/**
 * Returns a single terminology item by its unique ID or code.
 */
export function getTerminologyById(
  idOrCode: string,
  catalog: SampleTerminologyItem[] = sampleCatalog as SampleTerminologyItem[]
): SampleTerminologyItem | null {
  if (!idOrCode) return null;
  const target = idOrCode.trim().toLowerCase();
  return (
    catalog.find(
      (item) =>
        item.id.toLowerCase() === target || item.code.toLowerCase() === target
    ) || null
  );
}

/**
 * Returns summary count of terms per category in the catalog.
 */
export function getCategoryCounts(
  catalog: SampleTerminologyItem[] = sampleCatalog as SampleTerminologyItem[]
): Record<string, number> {
  const counts: Record<string, number> = {
    all: catalog.length,
    disease: 0,
    symptom: 0,
    pariksha: 0,
    procedure: 0,
    formulation: 0,
  };

  catalog.forEach((item) => {
    if (counts[item.category] !== undefined) {
      counts[item.category]++;
    }
  });

  return counts;
}
