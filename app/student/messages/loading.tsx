import { Loader2 } from "lucide-react";

export default function MessagesLoading() {
  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-ayush-brown" />
      <p className="text-sm font-medium text-ayush-muted animate-pulse">
        Loading Mentor Connect...
      </p>
    </div>
  );
}
