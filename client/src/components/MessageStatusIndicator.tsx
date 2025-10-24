import { Check, CheckCheck } from "lucide-react";

interface MessageStatusIndicatorProps {
  entregue: boolean;
  lida: boolean;
  isSentByMe: boolean;
}

export function MessageStatusIndicator({ entregue, lida, isSentByMe }: MessageStatusIndicatorProps) {
  // Só mostrar status para mensagens enviadas por mim
  if (!isSentByMe) return null;

  return (
    <div className="flex items-center" data-testid="message-status">
      {lida ? (
        <CheckCheck 
          className="h-4 w-4 text-blue-500 dark:text-blue-400" 
          data-testid="status-read"
        />
      ) : entregue ? (
        <CheckCheck 
          className="h-4 w-4 text-muted-foreground" 
          data-testid="status-delivered"
        />
      ) : (
        <Check 
          className="h-4 w-4 text-muted-foreground" 
          data-testid="status-sent"
        />
      )}
    </div>
  );
}
