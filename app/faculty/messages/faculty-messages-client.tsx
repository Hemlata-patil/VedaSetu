"use client";

import { useState, useEffect } from "react";
import { ChatClient } from "@/components/messages/chat-client";
import { getConversation, createRecommendation } from "@/app/messages/actions";
import { createClient } from "@/lib/supabase/client";
import { User, Plus, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function FacultyMessagesClient({ currentUser, students }: { currentUser: { id: string }, students: any[] }) {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Modal state
  const [showRecModal, setShowRecModal] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recDesc, setRecDesc] = useState("");
  const [recType, setRecType] = useState("skill");
  const [recPriority, setRecPriority] = useState("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Status check modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [sentRecs, setSentRecs] = useState<any[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  useEffect(() => {
    if (selectedStudent) {
      getConversation(selectedStudent.id).then((conv) => {
        if (conv) setConversationId(conv.id);
        else setConversationId(null);
      }).catch(console.error);
    } else {
      setConversationId(null);
    }
  }, [selectedStudent]);

  const handleAddRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversationId || !selectedStudent) return;
    setIsSubmitting(true);
    try {
      await createRecommendation(conversationId, selectedStudent.id, recTitle, recDesc, recType, recPriority);
      setShowRecModal(false);
      setRecTitle("");
      setRecDesc("");
      alert("Recommendation sent successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to send recommendation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewStatus = async () => {
    if (!selectedStudent) return;
    setIsLoadingRecs(true);
    setShowStatusModal(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("mentor_recommendations")
      .select("*")
      .eq("student_id", selectedStudent.id)
      .eq("mentor_id", currentUser.id)
      .order("created_at", { ascending: false });
    
    if (data) setSentRecs(data);
    setIsLoadingRecs(false);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[500px] gap-6">
      {/* Sidebar: Student List */}
      <div className="w-1/3 flex flex-col rounded-xl border border-ayush-border/80 bg-ayush-card shadow-warm overflow-hidden">
        <div className="border-b border-ayush-border/60 bg-ayush-sand/30 p-4">
          <h2 className="font-semibold text-ayush-dark">My Students</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {students.length === 0 ? (
            <div className="p-4 text-center text-sm text-ayush-muted">
              No active students.
            </div>
          ) : (
            students.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  selectedStudent?.id === student.id
                    ? "bg-ayush-brown text-ayush-card"
                    : "hover:bg-ayush-sand/50"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  selectedStudent?.id === student.id ? "bg-white/20" : "bg-ayush-brown text-white"
                )}>
                  <User className="h-4 w-4" />
                </div>
                <div className="truncate text-sm font-medium">
                  {student.full_name || "Student"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedStudent ? (
          conversationId ? (
            <div className="flex h-full flex-col space-y-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleViewStatus}
                  className="flex items-center gap-2 rounded-lg border border-ayush-brown/30 bg-ayush-sand px-4 py-2 text-sm font-medium text-ayush-brown transition-opacity hover:bg-ayush-sand/70"
                >
                  <FileText className="h-4 w-4" />
                  Check Status
                </button>
                <button
                  onClick={() => setShowRecModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-ayush-green px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Recommendation
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatClient 
                  conversationId={conversationId}
                  currentUser={currentUser}
                  otherUser={{
                    id: selectedStudent.id,
                    full_name: selectedStudent.full_name,
                    avatar_url: selectedStudent.avatar_url || undefined,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-ayush-border bg-ayush-sand/20">
              <p className="text-ayush-muted">Loading conversation...</p>
            </div>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center space-y-4 rounded-xl border border-dashed border-ayush-border bg-ayush-sand/20">
            <div className="rounded-full bg-white p-6 shadow-sm">
              <User className="h-8 w-8 text-ayush-muted" />
            </div>
            <p className="text-ayush-muted">Select a student from the list to start messaging.</p>
          </div>
        )}
      </div>

      {/* Recommendation Modal */}
      {showRecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-ayush-dark">Add Recommendation</h3>
            <form onSubmit={handleAddRecommendation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ayush-muted mb-1">Title</label>
                <input required type="text" value={recTitle} onChange={e => setRecTitle(e.target.value)} className="w-full rounded-md border border-ayush-border p-2 text-sm focus:border-ayush-brown focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ayush-muted mb-1">Description</label>
                <textarea value={recDesc} onChange={e => setRecDesc(e.target.value)} className="w-full rounded-md border border-ayush-border p-2 text-sm focus:border-ayush-brown focus:outline-none" rows={3}></textarea>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ayush-muted mb-1">Type</label>
                  <select value={recType} onChange={e => setRecType(e.target.value)} className="w-full rounded-md border border-ayush-border p-2 text-sm focus:border-ayush-brown focus:outline-none">
                    <option value="skill">Skill</option>
                    <option value="career">Career</option>
                    <option value="academic">Academic</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ayush-muted mb-1">Priority</label>
                  <select value={recPriority} onChange={e => setRecPriority(e.target.value)} className="w-full rounded-md border border-ayush-border p-2 text-sm focus:border-ayush-brown focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRecModal(false)} className="rounded-md px-4 py-2 text-sm font-medium text-ayush-muted hover:bg-ayush-sand/50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="rounded-md bg-ayush-brown px-4 py-2 text-sm font-medium text-white hover:bg-ayush-brown/90 disabled:opacity-50">
                  {isSubmitting ? "Sending..." : "Send Recommendation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recommendation Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-4 border-b border-ayush-border/60 pb-3">
              <h3 className="text-lg font-bold text-ayush-dark">Recommendation Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-ayush-muted hover:text-ayush-dark">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {isLoadingRecs ? (
                <div className="py-8 text-center text-sm text-ayush-muted">Loading recommendations...</div>
              ) : sentRecs.length === 0 ? (
                <div className="py-8 text-center text-sm text-ayush-muted">You haven't sent any recommendations to this student yet.</div>
              ) : (
                sentRecs.map(rec => (
                  <div key={rec.id} className="rounded-lg border border-ayush-border/70 p-3 bg-ayush-sand/20">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-ayush-dark text-sm">{rec.title}</h4>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium capitalize",
                        rec.status === "completed" ? "bg-ayush-green/20 text-ayush-green" :
                        rec.status === "in_progress" ? "bg-ayush-saffron/20 text-ayush-saffron" :
                        "bg-ayush-sand text-ayush-muted"
                      )}>
                        {rec.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-ayush-muted mb-2 line-clamp-2">{rec.description}</p>
                    <div className="flex gap-2 text-[10px] font-medium">
                      <span className="bg-white border border-ayush-border/50 px-1.5 py-0.5 rounded text-ayush-brown">{rec.type}</span>
                      <span className={cn(
                        "bg-white border px-1.5 py-0.5 rounded",
                        rec.priority === "high" ? "border-red-200 text-red-600" : "border-ayush-border/50 text-ayush-muted"
                      )}>
                        {rec.priority} priority
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
