"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { getOpportunityAiInsightsAction } from "../actions";
import type { OpportunityAiInsight } from "@/lib/ai/opportunity-insights";

interface AiOpportunityDetailCardProps {
  opportunityId: string;
  hasAssessedCompetencies: boolean;
  studentDepartment?: string | null;
}

export function AiOpportunityDetailCard({
  opportunityId,
  hasAssessedCompetencies,
  studentDepartment,
}: AiOpportunityDetailCardProps) {
  const [isPending, startTransition] = useTransition();
  const [insight, setInsight] = useState<OpportunityAiInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRequested, setHasRequested] = useState(false);

  const handleRequestInsight = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await getOpportunityAiInsightsAction(opportunityId);
        if (result.success) {
          const matched = result.insights[opportunityId] || null;
          setInsight(matched);
          setHasRequested(true);
        } else {
          setError(result.error || "Failed to generate AI insights.");
          setHasRequested(true);
        }
      } catch {
        setError(
          "AI Opportunity Insights are temporarily unavailable. Deterministic skill matching remains active."
        );
        setHasRequested(true);
      }
    });
  };

  return (
    <Card className="p-6 border-ayush-saffron/30 bg-gradient-to-br from-ayush-card via-ayush-sand/20 to-ayush-saffron/5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ayush-saffron/15 text-ayush-saffron">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <h3 className="font-heading font-bold text-ayush-dark text-base">
              AI Match Analysis & Gap Guidance
            </h3>
            <Badge variant="saffron" className="text-[10px] uppercase tracking-wider">
              Groq • Qwen 27B
            </Badge>
          </div>
          <p className="text-xs text-ayush-muted leading-relaxed">
            Generate tailored pedagogical rationale explaining how this opportunity fits your Ayush
            background ({studentDepartment || "AYUSH Scholar"}) and what specific steps bridge identified gaps.
          </p>
        </div>

        <div className="shrink-0">
          {hasAssessedCompetencies ? (
            <Button
              onClick={handleRequestInsight}
              disabled={isPending}
              size="sm"
              className="gap-2 bg-ayush-saffron hover:bg-ayush-saffron/90 text-white font-medium shadow-sm transition-all"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing with AI...</span>
                </>
              ) : hasRequested ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Re-analyze with AI</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze with Groq AI</span>
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
        <div className="rounded-lg bg-ayush-sand/60 border border-ayush-border/70 p-3 text-xs text-ayush-muted flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Complete your competency assessments to unlock personalized AI opportunity analysis.
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-ayush-terracotta/10 border border-ayush-terracotta/20 p-3 text-xs text-ayush-terracotta flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Insight */}
      {insight && (
        <div className="mt-4 rounded-xl bg-ayush-card border border-ayush-saffron/30 p-4 space-y-4 animate-in fade-in-50 duration-200">
          <div className="space-y-1">
            <span className="font-semibold text-ayush-brown text-xs block">
              Alignment Rationale:
            </span>
            <p className="text-xs text-ayush-dark leading-relaxed">{insight.whyItMayMatch}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insight.relevantCompetencies.length > 0 && (
              <div className="rounded bg-ayush-sand/30 p-3 border border-ayush-border/60 space-y-1.5">
                <span className="font-medium text-xs text-ayush-green flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Your Key Strengths
                </span>
                <ul className="list-disc list-inside text-xs text-ayush-muted space-y-1">
                  {insight.relevantCompetencies.map((comp, idx) => (
                    <li key={idx}>{comp}</li>
                  ))}
                </ul>
              </div>
            )}

            {insight.suggestedNextSteps.length > 0 && (
              <div className="rounded bg-ayush-sand/30 p-3 border border-ayush-border/60 space-y-1.5">
                <span className="font-medium text-xs text-ayush-saffron flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                  Bridging Steps & Recommendations
                </span>
                <ul className="list-disc list-inside text-xs text-ayush-muted space-y-1">
                  {insight.suggestedNextSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {insight.skillGaps.length > 0 && (
            <div className="text-xs text-ayush-muted pt-1 flex items-start gap-1.5 border-t border-ayush-border/40">
              <span className="font-medium text-amber-800 shrink-0">Identified Focus Gaps:</span>
              <span>{insight.skillGaps.join(" • ")}</span>
            </div>
          )}

          <p className="text-[10px] text-ayush-muted italic pt-1 border-t border-ayush-border/30">
            Guidance generated via Groq AI using verified competency records. Does not guarantee selection.
          </p>
        </div>
      )}
    </Card>
  );
}
