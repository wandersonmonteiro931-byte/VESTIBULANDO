import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function BrasiliaClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      setTime(formatter.format(now));
    };

    // Atualizar imediatamente
    updateTime();

    // Atualizar a cada segundo
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="header-clock-pill flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span className="font-mono">{time}</span>
    </div>
  );
}
