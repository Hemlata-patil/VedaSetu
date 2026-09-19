"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { startAssessment } from "./actions";

interface StartAssessmentButtonProps {
  templateId: string;
  label?: string;
  forceNew?: boolean;
  className?: string;
  variant?: "default" | "outline" | "herbal" | "saffron" | "destructive" | "secondary";
}

export function StartAssessmentButton({
  templateId,
  label,
  forceNew = false,
  className,
  variant = "default",
}: StartAssessmentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await startAssessment(templateId, forceNew);
      if (res?.attemptId) {
        router.push(`/student/assessment/${res.attemptId}`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to start assessment. Please try again.");
      setLoading(false);
    }
  }

  const defaultLabel = forceNew ? "Retake Assessment" : "Begin Assessment";
  const displayLabel = label || defaultLabel;

  return (
    <div className="space-y-2 w-full">
      <Button
        onClick={handleStart}
        disabled={loading}
        className={
          className ||
          (forceNew
            ? "w-full gap-2 bg-ayush-saffron hover:bg-ayush-saffron/90 text-white shadow-warm transition-all hover:translate-y-[-1px]"
            : "w-full gap-2 bg-ayush-green hover:bg-ayush-green/90 text-white shadow-warm transition-all hover:translate-y-[-1px]")
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{forceNew ? "Initializing Reassessment..." : "Starting Assessment..."}</span>
          </>
        ) : (
          <>
            {forceNew && <RotateCcw className="w-4 h-4 shrink-0" />}
            <span>{displayLabel}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
