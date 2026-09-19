import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ChatClient } from "@/components/messages/chat-client";

async function StudentMessagesContent() {
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

  // 2. Fetch conversation
  const { data: conversation } = await supabase
    .from("mentor_conversations")
    .select("id")
    .eq("student_id", user.id)
    .eq("mentor_id", activeMentorship.faculty_id)
    .maybeSingle();

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
      <div className="h-[calc(100vh-12rem)] min-h-[500px]">
        {conversation ? (
          <ChatClient
            conversationId={conversation.id}
            currentUser={user}
            otherUser={activeMentorship.mentor}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-ayush-muted">Conversation initializing...</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function StudentMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center p-8 text-ayush-muted">
          Loading messages...
        </div>
      }
    >
      <StudentMessagesContent />
    </Suspense>
  );
}
