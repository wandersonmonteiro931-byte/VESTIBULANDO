interface TypingIndicatorProps {
  userName?: string;
  show: boolean;
}

export function TypingIndicator({ userName = "Usuário", show }: TypingIndicatorProps) {
  return (
    <div 
      className={`transition-all duration-300 ease-in-out ${
        show ? 'h-12 opacity-100 mb-2' : 'h-0 opacity-0'
      }`}
      style={{
        overflow: 'hidden',
        transform: show ? 'translateY(0)' : 'translateY(-10px)',
      }}
      data-testid="typing-indicator-container"
    >
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground h-12" data-testid="typing-indicator">
        <div className="flex items-center gap-1">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
          </div>
          <span className="ml-2">digitando...</span>
        </div>
      </div>
    </div>
  );
}
