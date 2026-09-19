"use client";

import { useState } from "react";
import { updateRecommendationStatus } from "@/app/messages/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  created_at: string;
  mentor?: { full_name?: string };
}

export function RecommendationList({ initialRecommendations }: { initialRecommendations: Recommendation[] }) {
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setLoadingId(id);
    try {
      await updateRecommendationStatus(id, newStatus);
      setRecommendations(prev =>
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );
    } catch (error) {
      console.error("Failed to update status", error);
    } finally {
      setLoadingId(null);
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-ayush-border bg-ayush-sand/20">
        <p className="text-sm text-ayush-muted">No recommendations from your mentor yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {recommendations.map((rec) => (
        <Card key={rec.id} className="border-ayush-border/80 shadow-warm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base font-semibold">{rec.title}</CardTitle>
              <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "saffron" : "default"}>
                {rec.priority}
              </Badge>
            </div>
            <p className="text-xs text-ayush-muted mt-1">
              From: {rec.mentor?.full_name || "Mentor"} • Type: {rec.type}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-ayush-dark">{rec.description || "No description provided."}</p>
            
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-medium text-ayush-muted">Status:</span>
              <select
                className="rounded-md border border-ayush-border bg-white px-2 py-1 text-xs outline-none focus:border-ayush-brown"
                value={rec.status}
                onChange={(e) => handleStatusChange(rec.id, e.target.value)}
                disabled={loadingId === rec.id}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
