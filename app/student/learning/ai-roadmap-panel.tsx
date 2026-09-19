"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartAssessmentButton } from "@/app/student/assessment/start-assessment-button";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Compass,
  BookOpen,
  Award,
  ArrowRight,
  Clock,
  Target,
  GraduationCap,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { getPersonalizedLearningRoadmapAction } from "./actions";
import type { AiPersonalizedRoadmap } from "@/lib/ai/learning-roadmap";

interface AiRoadmapPanelProps {
  hasCompetencies: boolean;
  studentDepartment?: string | null;
  templateId?: string | null;
  hasSubmittedAttempt?: boolean;
}

export function AiRoadmapPanel({
  hasCompetencies,
  studentDepartment,
  templateId,
  hasSubmittedAttempt = false,
}: AiRoadmapPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [roadmap, setRoadmap] = useState<AiPersonalizedRoadmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerateRoadmap = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await getPersonalizedLearningRoadmapAction();
        if (result.success && result.roadmap) {
          setRoadmap(result.roadmap);
          setEvaluatedAt(result.evaluatedAt);
          setHasGenerated(true);
        } else {
          setError(result.error || "Failed to generate AI roadmap.");
          setHasGenerated(true);
        }
      } catch (err: any) {
        setError(
          "AI Learning Roadmap generation is temporarily unavailable. Standard platform guidance is active."
        );
        setHasGenerated(true);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Groq AI Learning Roadmap Trigger Card */}
      <Card className="p-6 border-ayush-saffron/30 bg-gradient-to-br from-ayush-card via-ayush-sand/20 to-ayush-saffron/5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ayush-saffron/15 text-ayush-saffron">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-heading font-bold text-ayush-dark text-base">
                AI-Powered Personalized Learning Roadmap
              </h3>
              <Badge variant="saffron" className="text-[10px] uppercase tracking-wider">
                Groq • Qwen 27B
              </Badge>
            </div>
            <p className="text-xs text-ayush-muted leading-relaxed max-w-2xl">
              Synthesizes your verified assessment scores across AYUSH domains ({studentDepartment || "AYUSH Scholar"}) into a tailored 3-stage developmental pathway with specific study activities, clinical tasks, and milestones.
            </p>
          </div>

          <div className="shrink-0">
            {hasCompetencies ? (
              <Button
                onClick={handleGenerateRoadmap}
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
                    <span>Regenerate AI Roadmap</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Roadmap</span>
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

        {/* Error State */}
        {error && (
          <div className="rounded-lg bg-ayush-terracotta/10 border border-ayush-terracotta/20 p-3 text-xs text-ayush-terracotta flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Unassessed Notice */}
        {!hasCompetencies && (
          <div className="rounded-lg bg-ayush-sand/60 border border-ayush-border/70 p-3 text-xs text-ayush-muted flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              You have not completed any competency assessments yet. Complete an assessment to generate your personalized learning roadmap.
            </span>
          </div>
        )}
      </Card>

      {/* 2. Generated AI Roadmap View */}
      {roadmap && (
        <div className="space-y-8 animate-in fade-in-50 duration-300">
          {/* Goal & Overview Banner */}
          <div className="rounded-2xl border border-ayush-saffron/40 bg-ayush-card p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ayush-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ayush-saffron/10 text-ayush-saffron">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-ayush-dark text-base">
                    Personalized Pedagogical Goal
                  </h4>
                  <span className="text-[11px] text-ayush-muted">
                    Recommended Timeline: {roadmap.suggestedTimelineMonths} Months
                  </span>
                </div>
              </div>
              {evaluatedAt && (
                <span className="text-[10px] text-ayush-muted">
                  Evaluated {new Date(evaluatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>

            <p className="text-sm text-ayush-dark leading-relaxed font-medium">
              &ldquo;{roadmap.personalizedGoal}&rdquo;
            </p>

            {/* Strengths & Priority Focus Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              {/* Key Strengths */}
              {roadmap.keyStrengths.length > 0 && (
                <div className="rounded-xl bg-ayush-herbal/5 border border-ayush-herbal/20 p-4 space-y-2.5">
                  <span className="font-heading text-xs font-bold text-ayush-herbal uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Key Strengths to Leverage
                  </span>
                  <div className="space-y-2">
                    {roadmap.keyStrengths.map((st, idx) => (
                      <div key={idx} className="text-xs bg-white/70 p-2.5 rounded-lg border border-ayush-border/50">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-ayush-dark">{st.competencyName}</span>
                          <span className="font-bold text-ayush-herbal">{st.score}%</span>
                        </div>
                        <p className="text-ayush-muted text-[11px] mt-0.5 leading-relaxed">{st.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Gaps */}
              {roadmap.priorityGaps.length > 0 && (
                <div className="rounded-xl bg-ayush-saffron/5 border border-ayush-saffron/20 p-4 space-y-2.5">
                  <span className="font-heading text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Priority Focus Areas
                  </span>
                  <div className="space-y-2">
                    {roadmap.priorityGaps.map((gap, idx) => (
                      <div key={idx} className="text-xs bg-white/70 p-2.5 rounded-lg border border-ayush-border/50">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-ayush-dark">{gap.competencyName}</span>
                          <span className="font-bold text-amber-800">{gap.score}%</span>
                        </div>
                        <p className="text-ayush-muted text-[11px] mt-0.5 leading-relaxed">{gap.rationale}</p>
                        <p className="text-[11px] text-ayush-dark font-medium mt-1">
                          <span className="text-amber-800">Target:</span> {gap.targetFocus}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3 Progressive Learning Phases */}
          <div className="space-y-4">
            <div>
              <h3 className="font-heading text-xl font-bold text-ayush-dark flex items-center gap-2">
                <span>Personalized 3-Phase Development Plan</span>
                <Badge variant="saffron" className="text-[10px]">
                  Adaptive Milestones
                </Badge>
              </h3>
              <p className="text-xs text-ayush-muted">
                Step-by-step progression connecting classical study, supervised practice, and evidence creation.
              </p>
            </div>

            <div className="space-y-6">
              {roadmap.phases.map((phase) => {
                const phaseIcons = [BookOpen, Compass, Award];
                const IconComp = phaseIcons[phase.phaseNumber - 1] || Layers;
                const badgeVariants: Array<"herbal" | "saffron" | "parchment"> = [
                  "herbal",
                  "saffron",
                  "parchment",
                ];
                const variant = badgeVariants[phase.phaseNumber - 1] || "herbal";

                return (
                  <div
                    key={phase.phaseNumber}
                    className="rounded-2xl border border-ayush-border/80 bg-ayush-card p-6 shadow-sm space-y-4 hover:border-ayush-border transition-all"
                  >
                    {/* Phase Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ayush-border/60">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ayush-sand/80 text-ayush-brown border border-ayush-border/60">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-heading text-lg font-bold text-ayush-dark">
                            {phase.title}
                          </h4>
                          <p className="text-xs text-ayush-muted">
                            {phase.focusSummary}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <Badge variant="parchment" className="text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3 text-ayush-muted" />
                          {phase.suggestedDuration}
                        </Badge>
                        <Badge variant={variant} className="text-xs">
                          Phase 0{phase.phaseNumber}
                        </Badge>
                      </div>
                    </div>

                    {/* Activities, Exercises, Milestones */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {/* Learning Activities */}
                      <div className="rounded-xl bg-ayush-sand/30 border border-ayush-border/50 p-4 space-y-2">
                        <span className="font-semibold text-xs text-ayush-dark flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-ayush-green" />
                          Learning & Study Activities
                        </span>
                        <ul className="list-disc list-inside text-xs text-ayush-muted space-y-1.5">
                          {phase.learningActivities.map((act, idx) => (
                            <li key={idx} className="leading-relaxed">{act}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Practical Exercises */}
                      <div className="rounded-xl bg-ayush-sand/30 border border-ayush-border/50 p-4 space-y-2">
                        <span className="font-semibold text-xs text-ayush-dark flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-ayush-saffron" />
                          Clinical & Practical Tasks
                        </span>
                        <ul className="list-disc list-inside text-xs text-ayush-muted space-y-1.5">
                          {phase.practicalExercises.map((ex, idx) => (
                            <li key={idx} className="leading-relaxed">{ex}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Milestones */}
                      <div className="rounded-xl bg-ayush-sand/30 border border-ayush-border/50 p-4 space-y-2">
                        <span className="font-semibold text-xs text-ayush-dark flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-ayush-gold" />
                          Phase Milestones
                        </span>
                        <ul className="list-disc list-inside text-xs text-ayush-muted space-y-1.5">
                          {phase.milestones.map((m, idx) => (
                            <li key={idx} className="leading-relaxed">{m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reassessment Guidance & Action */}
          {roadmap.reassessmentFocus.length > 0 && (
            <div className="rounded-xl bg-ayush-card border border-ayush-border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="font-semibold text-xs text-ayush-dark flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-ayush-green" />
                  Suggested Reassessment Milestones
                </span>
                <p className="text-xs text-ayush-muted">
                  {roadmap.reassessmentFocus.join(" • ")}
                </p>
              </div>

              {/* Direct reassessment button when templateId is known */}
              {templateId && hasSubmittedAttempt ? (
                <div className="shrink-0 min-w-[180px]">
                  <StartAssessmentButton
                    templateId={templateId}
                    label="Start Reassessment"
                    forceNew
                    className="gap-1.5 text-xs bg-ayush-saffron hover:bg-ayush-saffron/90 text-white px-3 py-1.5 h-auto"
                  />
                </div>
              ) : (
                <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs">
                  <Link href="/student/assessment">
                    <span>Take Reassessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          )}

          {/* Disclaimer Footer */}
          <div className="rounded-lg bg-ayush-sand/40 border border-ayush-border/60 p-3 text-[11px] text-ayush-muted leading-relaxed">
            <strong>Pedagogical Advisory:</strong> This AI-generated roadmap is personalized guidance for self-directed study. It does not replace official institutional syllabi or NCISM curricular mandates.
          </div>
        </div>
      )}
    </div>
  );
}
