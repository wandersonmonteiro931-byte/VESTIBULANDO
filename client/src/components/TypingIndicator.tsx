interface TypingIndicatorProps {
  userName?: string;
  show: boolean;
}

export function TypingIndicator({ userName = "Usuário", show }: TypingIndicatorProps) {
  return (
    <div 
      className="transition-all duration-500 ease-in-out overflow-hidden"
      style={{
        maxHeight: show ? '60px' : '0px',
        marginTop: show ? '8px' : '0px',
        marginBottom: show ? '8px' : '0px',
      }}
      data-testid="typing-indicator-container"
    >
      <div 
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground transition-all duration-500 ease-in-out"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? 'translateY(0)' : 'translateY(-10px)',
        }}
        data-testid="typing-indicator"
      >
        <div className="flex items-center gap-1">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
          </div>
          <span className="ml-2 whitespace-nowrap">digitando...</span>
        </div>
      </div>
    </div>
  );
}
