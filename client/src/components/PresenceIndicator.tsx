import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PresenceIndicatorProps {
  isOnline?: boolean;
  lastSeen?: string;
  lastActivity?: string;
  showLabel?: boolean;
  variant?: "badge" | "icon" | "text";
  isLoading?: boolean;
}

export function PresenceIndicator({
  isOnline = false,
  lastSeen,
  lastActivity,
  showLabel = true,
  variant = "badge",
  isLoading = false,
}: PresenceIndicatorProps) {
  const getFormattedLastSeen = () => {
    if (isLoading) return "...";
    if (!lastSeen) return "Offline";
    
    try {
      const date = new Date(lastSeen);
      const time = format(date, "HH:mm", { locale: ptBR });
      
      if (isToday(date)) {
        return `Visto por último hoje às ${time}`;
      } else if (isYesterday(date)) {
        return `Visto por último ontem às ${time}`;
      } else {
        const dateStr = format(date, "dd/MM/yyyy", { locale: ptBR });
        return `Visto por último em ${dateStr} às ${time}`;
      }
    } catch (error) {
      return "Offline";
    }
  };

  const statusText = isLoading ? "..." : (isOnline ? "Online agora" : getFormattedLastSeen());

  if (variant === "text") {
    return (
      <span className={`text-xs ${isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
        {statusText}
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Circle
                className={`h-2.5 w-2.5 ${isOnline ? "fill-green-500 text-green-500" : "fill-gray-400 text-gray-400"}`}
                data-testid={`presence-icon-${isOnline ? "online" : "offline"}`}
              />
              {showLabel && (
                <span className={`text-xs ${isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                  {statusText}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{statusText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1.5 ${
              isOnline
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-300 dark:border-gray-700"
            }`}
            data-testid={`presence-badge-${isOnline ? "online" : "offline"}`}
          >
            <Circle className={`h-2 w-2 ${isOnline ? "fill-green-500" : "fill-gray-400"}`} />
            {statusText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm font-medium">{statusText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
