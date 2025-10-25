import { useUserPresence } from "@/hooks/useUserPresence";

interface PresenceIndicatorProps {
  userId: string;
  showText?: boolean;
  className?: string;
}

export function PresenceIndicator({ userId, showText = false, className = "" }: PresenceIndicatorProps) {
  const { isOnline, statusText } = useUserPresence(userId);

  if (showText) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {isOnline && (
          <div className="w-2 h-2 rounded-full bg-green-500" data-testid="presence-online-dot" />
        )}
        <span className="text-xs text-muted-foreground" data-testid="presence-status-text">
          {statusText}
        </span>
      </div>
    );
  }

  if (isOnline) {
    return (
      <div 
        className={`w-3 h-3 rounded-full bg-green-500 border-2 border-white ${className}`}
        data-testid="presence-online-badge"
      />
    );
  }

  return null;
}
