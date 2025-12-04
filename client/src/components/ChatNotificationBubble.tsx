import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface ChatNotificationBubbleProps {
  show: boolean;
  senderName: string;
  message: string;
  conversationId: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function ChatNotificationBubble({
  show,
  senderName,
  message,
  conversationId,
  onDismiss,
  autoDismissMs = 5000,
}: ChatNotificationBubbleProps) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (show && autoDismissMs > 0) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [show, autoDismissMs, onDismiss]);

  const handleClick = () => {
    onDismiss();
    navigate(`/chat/${conversationId}`);
  };

  const truncateMessage = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "fixed bottom-20 right-6 z-50",
            "bg-card border border-border rounded-xl shadow-lg",
            "max-w-xs w-72 cursor-pointer",
            "hover:shadow-xl transition-shadow"
          )}
          onClick={handleClick}
          data-testid="chat-notification-bubble"
        >
          <div className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {senderName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {truncateMessage(message)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                data-testid="button-dismiss-notification"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="h-1 bg-primary/20 rounded-b-xl overflow-hidden">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
              className="h-full bg-primary"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
