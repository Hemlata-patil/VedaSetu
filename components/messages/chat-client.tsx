"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/app/messages/actions";
import { Send, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatClientProps {
  conversationId: string;
  currentUser: { id: string };
  otherUser: { id: string; full_name?: string; avatar_url?: string };
}

interface Message {
  id: string;
  sender_id: string;
  sender_role: "student" | "mentor";
  message: string;
  created_at: string;
}

export function ChatClient({ conversationId, currentUser, otherUser }: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("mentor_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };

    fetchMessages();
  }, [conversationId, supabase]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mentor_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Check if we already have this exact message as an optimistic insert
            const existingOptIndex = prev.findIndex(m => m.message === newMsg.message && m.sender_id === newMsg.sender_id && m.id.startsWith("optimistic-"));
            if (existingOptIndex >= 0) {
              const updated = [...prev];
              updated[existingOptIndex] = newMsg;
              return updated;
            }
            // Prevent exact duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setIsSending(true);
    setNewMessage("");

    // Optimistic UI update
    const optimisticMessage: Message = {
      id: "optimistic-" + Date.now(),
      sender_id: currentUser.id,
      sender_role: "student", // Display role doesn't matter for the CSS, sender_id is what matters
      message: messageText,
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await sendMessage(conversationId, messageText);
    } catch (error) {
      console.error("Failed to send message", error);
      // Remove optimistic message on failure and restore text
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-ayush-border/80 bg-ayush-card shadow-warm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-ayush-border/60 bg-ayush-sand/30 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ayush-brown text-ayush-card">
          <UserIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-ayush-dark">
            {otherUser.full_name || "Unknown User"}
          </h3>
          <p className="text-xs text-ayush-muted">Active Mentorship Conversation</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ayush-muted">
            No messages yet. Send a message to start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full",
                  isMe ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    isMe
                      ? "bg-ayush-brown text-ayush-card rounded-tr-sm"
                      : "bg-ayush-sand/50 text-ayush-dark border border-ayush-border/50 rounded-tl-sm"
                  )}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-ayush-border/60 p-4 bg-ayush-card">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full border border-ayush-border/80 bg-white px-4 py-2 text-sm focus:border-ayush-brown focus:outline-none focus:ring-1 focus:ring-ayush-brown"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ayush-brown text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
