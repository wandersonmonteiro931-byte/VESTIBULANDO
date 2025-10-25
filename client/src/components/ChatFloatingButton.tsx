import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function ChatFloatingButton() {
  const [, setLocation] = useLocation();

  return (
    <Button
      size="icon"
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg",
        "bg-[#25d366] hover:bg-[#20ba5a] text-white",
        "z-50 transition-all hover:scale-110"
      )}
      onClick={() => setLocation("/chat")}
      data-testid="button-chat-floating"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
}
