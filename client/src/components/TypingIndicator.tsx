interface TypingIndicatorProps {
  userName?: string;
  show: boolean;
}

export function TypingIndicator({ userName = "Usuário", show }: TypingIndicatorProps) {
  if (!show) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground" data-testid="typing-indicator">
      <div className="flex items-center gap-1">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
        </div>
        <span className="ml-2">{userName} está digitando...</span>
      </div>
    </div>
  );
}
