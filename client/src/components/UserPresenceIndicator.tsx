import { useUserPresenceStatus } from "@/hooks/useUserPresenceStatus";
import { cn } from "@/lib/utils";

interface UserPresenceIndicatorProps {
  userId: string | null | undefined;
  showText?: boolean;
  className?: string;
  dotClassName?: string;
  textClassName?: string;
  variant?: "default" | "light";
  isBlocked?: boolean;
}

/**
 * Componente que exibe indicador de presença de um usuário
 * Mostra um ponto verde se online, cinza se offline
 * Opcionalmente mostra texto com o status
 * Se bloqueado, não mostra nenhuma informação de presença
 */
export function UserPresenceIndicator({
  userId,
  showText = true,
  className = "",
  dotClassName = "",
  textClassName = "",
  variant = "default",
  isBlocked = false,
}: UserPresenceIndicatorProps) {
  const { isOnline, statusText } = useUserPresenceStatus(userId);

  if (isBlocked) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)} data-testid="user-presence-indicator">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          isOnline 
            ? "bg-green-500 dark:bg-green-400 animate-pulse" 
            : variant === "light" 
              ? "bg-gray-300 dark:bg-gray-400"
              : "bg-gray-400 dark:bg-gray-600",
          dotClassName
        )}
        data-testid={`presence-dot-${isOnline ? 'online' : 'offline'}`}
      />
      {showText && (
        <span 
          className={cn(
            "text-xs",
            variant === "light" 
              ? "text-white/80" 
              : "text-muted-foreground",
            textClassName
          )}
          data-testid="presence-status-text"
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
