"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase,
  Building2,
  Calendar,
  MapPin,
  Award,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  BookOpen,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getOpportunityAiInsightsAction } from "./actions";
import type { OpportunityAiInsight } from "@/lib/ai/opportunity-insights";

export interface SerializedOpportunity {
  id: string;
  title: string;
  description: string;
  opportunity_type: string;
  location: string | null;
  work_mode: string | null;
  eligibility: string | null;
  application_deadline: string | null;
  created_at: string;
  organizations?: {
    id: string;
    name: string;
  } | null;
  requirements: Array<{
    competencyId: string;
    competencyName: string;
    category: string;
    requiredScore: number;
    weight: number;
  }>;
  matchResult: {
    hasRequirements: boolean;
    skillMatchPercentage: number | null;
    totalRequirementsCount: number;
    metCount: number;
    details: Array<{
      competencyId: string;
      competencyName: string;
      category: string;
      requiredScore: number;
      studentScore: number | null;
      isMet: boolean;
      status: string;
      gap: number;
    }>;
    skillGaps: Array<any>;
  };
}

interface OpportunitiesClientProps {
  initialOpportunities: SerializedOpportunity[];
  hasAssessedCompetencies: boolean;
  studentDepartment?: string | null;
}

export function OpportunitiesClient({
  initialOpportunities,
  hasAssessedCompetencies,
  studentDepartment,
}: OpportunitiesClientProps) {
  const [isPending, startTransition] = useTransition();
  const [insights, setInsights] = useState<Record<string, OpportunityAiInsight>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [expandedInsightIds, setExpandedInsightIds] = useState<Set<string>>(new Set());

  const handleGenerateAiInsights = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await getOpportunityAiInsightsAction();
        if (result.success) {
          setInsights(result.insights || {});
          setSummary(result.summary || null);
          setEvaluatedAt(result.evaluatedAt);
          setHasGenerated(true);

          // Auto-expand all returned insights
          const ids = new Set(Object.keys(result.insights || {}));
          setExpandedInsightIds(ids);
        } else {
          setError(result.error || "Failed to generate AI insights.");
          setHasGenerated(true);
        }
      } catch (err: any) {
        setError(
          "AI Opportunity Insights are temporarily unavailable. Deterministic skill matching remains active."
        );
        setHasGenerated(true);
      }
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedInsightIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Transparent Skill Matching Notice */}
      <div className="rounded-xl border border-ayush-border/80 bg-ayush-card p-4 text-xs text-ayush-muted flex items-start gap-3 shadow-sm">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ayush-herbal/10 text-ayush-herbal">
          <Award className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <p className="font-semibold text-ayush-dark">Transparent Skill Matching</p>
          <p className="leading-relaxed">
            Your <strong>Skill Match</strong> is calculated by comparing your verified competency
            assessment scores against each opportunity&apos;s required benchmarks. Unassessed
            competencies are marked as &ldquo;Not Assessed&rdquo; and do not contribute to requirement
            completion.
          </p>
        </div>
      </div>

      {/* 2. Groq AI Opportunity Insights Panel */}
      <Card className="p-5 border-ayush-saffron/30 bg-gradient-to-br from-ayush-card via-ayush-sand/20 to-ayush-saffron/5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ayush-saffron/15 text-ayush-saffron">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-heading font-bold text-ayush-dark text-base">
                AI Opportunity Insights & Bridging Advice
              </h3>
              <Badge variant="saffron" className="text-[10px] uppercase tracking-wider">
                Groq • Qwen 27B
              </Badge>
            </div>
            <p className="text-xs text-ayush-muted leading-relaxed max-w-2xl">
              Receive personalized rationale on why candidate opportunities align with your Ayush
              academic profile ({studentDepartment || "AYUSH Scholar"}), along with actionable next
              steps for bridging skill gaps.
            </p>
          </div>

          <div className="shrink-0">
            {hasAssessedCompetencies ? (
              <Button
                onClick={handleGenerateAiInsights}
                disabled={isPending}
                size="sm"
                className="gap-2 bg-ayush-saffron hover:bg-ayush-saffron/90 text-white font-medium shadow-sm transition-all"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Competencies...</span>
                  </>
                ) : hasGenerated ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Refresh AI Insights</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Insights</span>
                  </>
                )}
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="gap-2 text-xs">
                <Link href="/student/assessment">
                  <BookOpen className="w-3.5 h-3.5 text-ayush-saffron" />
                  <span>Take Assessment First</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Unassessed notice */}
        {!hasAssessedCompetencies && (
          <div className="mt-4 rounded-lg bg-ayush-sand/60 border border-ayush-border/70 p-3 text-xs text-ayush-muted flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              You have not completed any competency assessments yet. Complete a skill assessment to
              enable personalized AI matching and gap analysis.
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-lg bg-ayush-terracotta/10 border border-ayush-terracotta/20 p-3 text-xs text-ayush-terracotta flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* AI Summary Banner */}
        {summary && (
          <div className="mt-4 rounded-xl bg-ayush-card border border-ayush-saffron/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ayush-dark flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-ayush-saffron" />
                Strategic Advisor Summary
              </span>
              {evaluatedAt && (
                <span className="text-[10px] text-ayush-muted">
                  Evaluated {new Date(evaluatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-xs text-ayush-dark leading-relaxed whitespace-pre-line">{summary}</p>
            <p className="text-[10px] text-ayush-muted italic pt-1 border-t border-ayush-border/40">
              Guidance generated via Groq AI using verified competency records. Does not guarantee selection.
            </p>
          </div>
        )}
      </Card>

      {/* 3. Opportunities List */}
      {initialOpportunities.length > 0 ? (
        <div className="grid grid-cols-1 gap-5">
          {initialOpportunities.map((opp) => {
            const orgName = opp.organizations?.name || "Ayush Partner Organization";
            const match = opp.matchResult;
            const matchPercentage = match.skillMatchPercentage;
            const insight = insights[opp.id];
            const isExpanded = expandedInsightIds.has(opp.id);

            return (
              <Card
                key={opp.id}
                className={`p-6 transition-all shadow-sm ${
                  insight
                    ? "border-ayush-saffron/40 hover:border-ayush-saffron/70"
                    : "hover:border-ayush-border/90"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left content area */}
                  <div className="space-y-3 flex-1">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="herbal" className="text-[10px] capitalize">
                          {opp.opportunity_type?.replace(/_/g, " ")}
                        </Badge>
                        {opp.work_mode && (
                          <Badge variant="parchment" className="text-[10px] capitalize">
                            {opp.work_mode}
                          </Badge>
                        )}
                        <span className="text-xs text-ayush-muted flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-ayush-brown/60" />
                          {orgName}
                        </span>
                        {insight && (
                          <Badge variant="saffron" className="text-[10px] gap-1">
                            <Sparkles className="w-3 h-3" />
                            AI Insight Ready
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-heading text-xl font-bold text-ayush-dark pt-0.5">
                        {opp.title}
                      </h3>
                    </div>

                    <p className="text-xs text-ayush-muted line-clamp-2 leading-relaxed">
                      {opp.description}
                    </p>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-ayush-muted pt-1">
                      {opp.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-ayush-brown/70" />
                          {opp.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-ayush-brown/70" />
                        {opp.application_deadline
                          ? `Deadline: ${opp.application_deadline}`
                          : "No deadline specified"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-ayush-gold" />
                        {opp.requirements.length > 0
                          ? `${opp.requirements.length} Required ${
                              opp.requirements.length === 1 ? "Competency" : "Competencies"
                            }`
                          : "Skills not specified"}
                      </span>
                    </div>

                    {/* Competency tags preview */}
                    {opp.requirements.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {opp.requirements.slice(0, 4).map((r) => (
                          <span
                            key={r.competencyId}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-ayush-sand/50 text-ayush-dark border border-ayush-border/50"
                          >
                            {r.competencyName} (Min: {r.requiredScore})
                          </span>
                        ))}
                        {opp.requirements.length > 4 && (
                          <span className="text-[11px] text-ayush-muted self-center">
                            +{opp.requirements.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Match Score Card & Action */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between lg:justify-center gap-4 shrink-0 lg:min-w-[200px] border-t lg:border-t-0 pt-4 lg:pt-0 border-ayush-border/60">
                    <div className="w-full sm:w-auto lg:w-full text-left lg:text-right">
                      {match.hasRequirements && matchPercentage !== null ? (
                        <div className="space-y-1.5">
                          <div className="flex items-baseline lg:justify-end gap-1.5">
                            <span className="text-xs font-semibold text-ayush-muted uppercase tracking-wider">
                              Skill Match:
                            </span>
                            <span className="font-heading text-2xl font-bold text-ayush-herbal">
                              {matchPercentage}%
                            </span>
                          </div>
                          <div className="w-full lg:w-36 lg:ml-auto">
                            <Progress value={matchPercentage} className="h-1.5" />
                          </div>
                          <p className="text-[10px] text-ayush-muted">
                            {match.metCount} of {match.totalRequirementsCount} requirements met
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="parchment" className="text-[11px]">
                            Skills not specified
                          </Badge>
                          <p className="text-[10px] text-ayush-muted">General qualification</p>
                        </div>
                      )}
                    </div>

                    <Button asChild size="sm" variant="default" className="w-full sm:w-auto gap-2">
                      <Link href={`/student/opportunities/${opp.id}`}>
                        <span>View Opportunity</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* AI Opportunity Insight Dropdown / Accordion */}
                {insight && (
                  <div className="mt-5 pt-4 border-t border-ayush-saffron/20 bg-ayush-sand/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => toggleExpand(opp.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-ayush-dark hover:text-ayush-saffron transition-colors text-left"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-ayush-saffron shrink-0" />
                        <span>AI Match Rationale & Next Steps</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-ayush-muted ml-1" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-ayush-muted ml-1" />
                        )}
                      </button>
                      <Badge variant="parchment" className="text-[10px]">
                        Pedagogical Guidance
                      </Badge>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 pt-2 text-xs text-ayush-dark animate-in fade-in-50 duration-200">
                        {/* Why it matches */}
                        <div className="space-y-1">
                          <span className="font-semibold text-ayush-brown text-[11px] block">
                            Why this opportunity aligns with your profile:
                          </span>
                          <p className="text-ayush-dark leading-relaxed">{insight.whyItMayMatch}</p>
                        </div>

                        {/* Relevant competencies and next steps */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {insight.relevantCompetencies.length > 0 && (
                            <div className="rounded bg-ayush-card/80 p-2.5 border border-ayush-border/60 space-y-1">
                              <span className="font-medium text-[11px] text-ayush-green flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                Key Strengths
                              </span>
                              <ul className="list-disc list-inside text-[11px] text-ayush-muted space-y-0.5">
                                {insight.relevantCompetencies.map((comp, idx) => (
                                  <li key={idx}>{comp}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {insight.suggestedNextSteps.length > 0 && (
                            <div className="rounded bg-ayush-card/80 p-2.5 border border-ayush-border/60 space-y-1">
                              <span className="font-medium text-[11px] text-ayush-saffron flex items-center gap-1">
                                <Lightbulb className="w-3 h-3 shrink-0" />
                                Recommended Next Steps
                              </span>
                              <ul className="list-disc list-inside text-[11px] text-ayush-muted space-y-0.5">
                                {insight.suggestedNextSteps.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Skill gaps if any */}
                        {insight.skillGaps.length > 0 && (
                          <div className="text-[11px] text-ayush-muted pt-1 flex items-start gap-1.5">
                            <span className="font-medium text-amber-800 shrink-0">Focus Areas:</span>
                            <span>{insight.skillGaps.join(" • ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ayush-sand/80 text-ayush-brown border border-ayush-border/70">
              <Briefcase className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-heading text-xl font-semibold text-ayush-dark">
                No Opportunities Available
              </h3>
              <p className="text-xs text-ayush-muted leading-relaxed">
                There are currently no active published opportunities. Industry partners frequently
                post clinical internships, research fellowships, and live projects.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/student/dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
