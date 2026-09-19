"use client";

import * as React from "react";
import { SampleTerminologyItem, TerminologyCategory, TERMINOLOGY_CATEGORIES } from "@/lib/terminology/types";
import { searchTerminology, getCategoryCounts } from "@/lib/terminology/search";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  Search,
  BookOpen,
  Filter,
  Info,
  X,
  Sparkles,
  Tag,
  Stethoscope,
  FileText,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminologySearchProps {
  initialCatalog?: SampleTerminologyItem[];
  className?: string;
}

export function TerminologySearch({
  initialCatalog,
  className,
}: TerminologySearchProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<TerminologyCategory | "all">("all");
  const [selectedItem, setSelectedItem] = React.useState<SampleTerminologyItem | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Compute category counts
  const categoryCounts = React.useMemo(() => {
    return getCategoryCounts(initialCatalog);
  }, [initialCatalog]);

  // Execute search filter
  const searchResults = React.useMemo(() => {
    return searchTerminology(
      {
        query: searchQuery,
        category: selectedCategory,
      },
      initialCatalog
    );
  }, [searchQuery, selectedCategory, initialCatalog]);

  const handleOpenDetails = (item: SampleTerminologyItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
  };

  const getCategoryBadgeVariant = (category: TerminologyCategory) => {
    switch (category) {
      case "disease":
        return "saffron";
      case "symptom":
        return "destructive";
      case "pariksha":
        return "herbal";
      case "procedure":
        return "parchment";
      case "formulation":
        return "secondary";
      default:
        return "default";
    }
  };

  const getCategoryLabel = (category: TerminologyCategory) => {
    const found = TERMINOLOGY_CATEGORIES.find((c) => c.key === category);
    return found ? found.shortLabel : category;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. Mandatory Sample Data Warning Banner */}
      <div className="rounded-2xl border border-amber-300/80 bg-amber-50/70 p-4 sm:p-5 shadow-warm text-ayush-dark">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-amber-200/60 text-amber-900 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading font-bold text-sm tracking-wide text-amber-950 uppercase">
                Prototype Demonstration
              </span>
              <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">
                SAMPLE DATA — NOT OFFICIAL NAMASTE DATA
              </Badge>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              This interface is a <strong>Phase 1 terminology prototype</strong> for the upcoming Ayush clinical e-Logbook.
              All items are sample demonstration records with codes prefixed by <code className="font-mono bg-amber-200/50 px-1 py-0.5 rounded text-[11px] font-bold">SAMPLE-</code>.
              No official Ministry of Ayush NAMASTE API is connected in this prototype.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Search & Category Controls Bar */}
      <Card className="border-ayush-border/80 shadow-warm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ayush-muted" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Ayush terminology... (e.g. Amavata, Shvasa, Nadi, Vamana)"
              className="pl-10 pr-10 h-11 text-sm bg-ayush-card"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ayush-muted hover:text-ayush-dark rounded-md hover:bg-ayush-sand/50"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ayush-muted">
              <span className="flex items-center gap-1.5 font-medium text-ayush-dark">
                <Filter className="w-3.5 h-3.5 text-ayush-saffron" />
                <span>Filter by Clinical Category:</span>
              </span>
              <span>
                Showing <strong>{searchResults.length}</strong> of <strong>{categoryCounts.all || 0}</strong> terms
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {TERMINOLOGY_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                const count = categoryCounts[cat.key] ?? 0;

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border",
                      isSelected
                        ? "bg-ayush-brown text-ayush-card border-ayush-brown shadow-warm"
                        : "bg-ayush-sand/40 text-ayush-dark border-ayush-border/70 hover:bg-ayush-sand hover:text-ayush-brown"
                    )}
                  >
                    <span>{cat.shortLabel}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-ayush-sand text-ayush-muted"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Results Section */}
      {searchResults.length === 0 ? (
        <Card className="border-dashed border-ayush-border p-8 sm:p-12 text-center bg-ayush-sand/20">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-ayush-sand flex items-center justify-center mx-auto text-ayush-muted border border-ayush-border">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-ayush-dark">
              No matching terminology found
            </h3>
            <p className="text-xs text-ayush-muted leading-relaxed">
              No sample terminology records matched &ldquo;<span className="font-medium text-ayush-dark">{searchQuery}</span>&rdquo;
              {selectedCategory !== "all" && ` in the ${selectedCategory} category`}. Try adjusting your search query or clear active filters.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                <span>Clear Filters & Reset</span>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.map((item) => (
            <Card
              key={item.id}
              className="border-ayush-border/80 hover:border-ayush-green/50 transition-all duration-200 hover:shadow-warm flex flex-col justify-between group overflow-hidden"
            >
              <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  {/* Category & Sample Code Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant={getCategoryBadgeVariant(item.category)} dot className="capitalize text-[11px]">
                      {getCategoryLabel(item.category)}
                    </Badge>
                    <span className="font-mono text-[11px] font-bold text-ayush-brown px-2 py-0.5 rounded bg-ayush-sand/70 border border-ayush-border/60">
                      {item.code}
                    </span>
                  </div>

                  {/* Term Name & Transliteration */}
                  <div>
                    <h4 className="font-heading text-lg font-bold text-ayush-dark group-hover:text-ayush-green transition-colors">
                      {item.term}
                    </h4>
                    {item.transliteration && item.transliteration !== item.term && (
                      <p className="text-xs text-ayush-muted font-serif italic">
                        {item.transliteration}
                      </p>
                    )}
                  </div>

                  {/* Clinical Domain */}
                  {item.clinical_domain && (
                    <div className="flex items-center gap-1.5 text-[11px] text-ayush-muted">
                      <Stethoscope className="w-3.5 h-3.5 text-ayush-saffron shrink-0" />
                      <span className="truncate">{item.clinical_domain}</span>
                    </div>
                  )}

                  {/* Short Clinical Description */}
                  <p className="text-xs text-ayush-dark/85 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Card Footer: Alternative terms preview + Action */}
                <div className="pt-3 border-t border-ayush-border/50 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-ayush-muted truncate flex-1">
                    {item.alternative_terms && item.alternative_terms.length > 0 && (
                      <span className="truncate block">
                        Synonyms: <span className="text-ayush-dark/80">{item.alternative_terms.slice(0, 2).join(", ")}</span>
                        {item.alternative_terms.length > 2 && "..."}
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDetails(item)}
                    className="gap-1.5 text-xs shrink-0 hover:bg-ayush-green hover:text-white hover:border-ayush-green transition-all"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 4. Complete Record Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={selectedItem.term}
          description={selectedItem.transliteration ? `Sanskrit Transliteration: ${selectedItem.transliteration}` : undefined}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-ayush-muted font-mono">
                ID: {selectedItem.id}
              </span>
              <Button size="sm" onClick={handleCloseModal}>
                Close Details
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Top Prototype Badge Banner inside Modal */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-amber-900 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Sample Demonstration Record</span>
              </div>
              <Badge variant="destructive" className="text-[10px]">
                SAMPLE DATA
              </Badge>
            </div>

            {/* Key Record Attributes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-ayush-sand/30 border border-ayush-border/50 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-ayush-muted block">
                  Sample Code
                </span>
                <span className="font-mono font-bold text-xs text-ayush-brown block truncate">
                  {selectedItem.code}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-ayush-sand/30 border border-ayush-border/50 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-ayush-muted block">
                  Category
                </span>
                <Badge variant={getCategoryBadgeVariant(selectedItem.category)} className="capitalize text-[10px]">
                  {getCategoryLabel(selectedItem.category)}
                </Badge>
              </div>

              <div className="p-3 rounded-xl bg-ayush-sand/30 border border-ayush-border/50 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-ayush-muted block">
                  Clinical Domain
                </span>
                <span className="text-xs font-semibold text-ayush-dark block truncate">
                  {selectedItem.clinical_domain || "General Ayurveda"}
                </span>
              </div>
            </div>

            {/* Full Classical Description */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-ayush-muted flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-ayush-green" />
                <span>Clinical & Classical Description</span>
              </h5>
              <div className="p-4 rounded-xl bg-ayush-sand/20 border border-ayush-border/60 text-xs text-ayush-dark leading-relaxed">
                {selectedItem.description}
              </div>
            </div>

            {/* Alternative Terms / Synonyms */}
            {selectedItem.alternative_terms && selectedItem.alternative_terms.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-ayush-muted flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-ayush-saffron" />
                  <span>Synonyms & Alternative Search Terms</span>
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.alternative_terms.map((alt, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-ayush-sand/50 text-ayush-dark border border-ayush-border/60 text-xs font-medium"
                    >
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata & Governance */}
            <div className="p-3 rounded-xl bg-ayush-sand/15 border border-ayush-border/40 text-[11px] text-ayush-muted space-y-1">
              <div className="flex justify-between">
                <span>Data Source:</span>
                <strong className="text-ayush-dark">{selectedItem.source}</strong>
              </div>
              <div className="flex justify-between">
                <span>Verification Status:</span>
                <strong className="text-amber-800">{selectedItem.verification_status}</strong>
              </div>
              <p className="text-[10px] text-ayush-muted/80 pt-1 italic">
                {selectedItem.disclaimer}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
