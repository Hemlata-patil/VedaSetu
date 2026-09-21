"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateStudentPlacementStatus } from "@/app/student/internship-placement/actions";

interface StudentPlacementActionsProps {
  placementId: string;
}

export function StudentPlacementActions({ placementId }: StudentPlacementActionsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (status: "offer_accepted" | "withdrawn") => {
    setIsLoading(true);
    try {
      await updateStudentPlacementStatus(placementId, status);
      // Wait for server revalidation to refresh the page
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Something went wrong.");
      setIsLoading(false); // Only reset if error, success will re-render component
    }
  };

  return (
    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-ayush-parchment/30">
      <p className="text-sm font-medium text-ayush-text mr-auto">Action Required:</p>
      <Button 
        variant="outline" 
        size="sm" 
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        onClick={() => handleAction("withdrawn")}
        disabled={isLoading}
      >
        Decline Offer
      </Button>
      <Button 
        variant="secondary" 
        size="sm"
        onClick={() => handleAction("offer_accepted")}
        disabled={isLoading}
      >
        {isLoading ? "Processing..." : "Accept Offer"}
      </Button>
    </div>
  );
}
