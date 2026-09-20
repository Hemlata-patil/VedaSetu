import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ChatClient } from "@/components/messages/chat-client";
import { RecommendationList } from "@/components/messages/recommendation-list";
import { MessagesTabs } from "./messages-tabs";

export default async function StudentMessagesPage() {
  await connection();
  const { user, profile } = await requireRole("student");
  const supabase = await createClient();

  // 1. Check if mentorship is active
  const { data: activeMentorship } = await supabase
    .from("mentorships")
    .select("*, mentor:profiles!faculty_id(id, full_name, avatar_url)")
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!activeMentorship) {
    return (
      <DashboardShell
        userRole="student"
        userName={profile.full_name || "Ayush Scholar"}
        userEmail={profile.email}
        breadcrumbs={[
          { label: "Student Portal", href: "/student/dashboard" },
          { label: "Messages" },
        ]}
      >
        <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
          <div className="rounded-full bg-ayush-sand p-6">
            <span className="text-4xl">💬</span>
          </div>
          <h2 className="text-xl font-heading font-semibold text-ayush-dark">
            No Active Mentorship
          </h2>
          <p className="text-sm text-ayush-muted text-center max-w-md">
            You can only access messages once a faculty member accepts your mentorship request.
          </p>
        </div>
      </DashboardShell>
    );
  }

  // 2. Fetch or create conversation
  let { data: conversation } = await supabase
    .from("mentor_conversations")
    .select("id")
    .eq("student_id", user.id)
    .eq("mentor_id", activeMentorship.faculty_id)
    .maybeSingle();

  if (!conversation) {
    // Auto-create if missing
    await supabase.from("mentor_conversations").upsert(
      { student_id: user.id, mentor_id: activeMentorship.faculty_id },
      { onConflict: "student_id, mentor_id", ignoreDuplicates: true }
    );
    const { data: newConv } = await supabase
      .from("mentor_conversations")
      .select("id")
      .eq("student_id", user.id)
      .eq("mentor_id", activeMentorship.faculty_id)
      .maybeSingle();
    conversation = newConv;
  }

  // 3. Fetch recommendations
  const { data: recommendations } = await supabase
    .from("mentor_recommendations")
    .select("*, mentor:profiles!mentor_id(full_name)")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const chatContent = conversation ? (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading chat...</div>}>
      <ChatClient 
        conversationId={conversation.id} 
        currentUser={user} 
        otherUser={activeMentorship.mentor} 
      />
    </Suspense>
  ) : (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-ayush-border/80 bg-ayush-sand/20">
      <p className="text-ayush-muted">Conversation initializing...</p>
    </div>
  );

  const recommendationsContent = (
    <RecommendationList initialRecommendations={recommendations || []} />
  );

  return (
    <DashboardShell
      userRole="student"
      userName={profile.full_name || "Ayush Scholar"}
      userEmail={profile.email}
      breadcrumbs={[
        { label: "Student Portal", href: "/student/dashboard" },
        { label: "Messages & Recommendations" },
      ]}
    >
      <div className="h-[calc(100vh-12rem)] min-h-[500px]">
        <MessagesTabs 
          chatContent={chatContent} 
          recommendationsContent={recommendationsContent} 
        />
      </div>
    </DashboardShell>
  );
}
