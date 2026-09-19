"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Target } from "lucide-react";

export function MessagesTabs({ 
  chatContent, 
  recommendationsContent 
}: { 
  chatContent: React.ReactNode; 
  recommendationsContent: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <h1 className="text-2xl font-heading font-bold text-ayush-dark">Mentor Connect</h1>
        <TabsList>
          <TabsTrigger value="chat" icon={MessageSquare}>
            Chat
          </TabsTrigger>
          <TabsTrigger value="recommendations" icon={Target}>
            Recommendations
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="chat" className="flex-1 mt-0 h-[calc(100%-3rem)] min-h-0">
        {chatContent}
      </TabsContent>

      <TabsContent value="recommendations" className="flex-1 mt-0 h-[calc(100%-3rem)] overflow-y-auto">
        {recommendationsContent}
      </TabsContent>
    </Tabs>
  );
}
