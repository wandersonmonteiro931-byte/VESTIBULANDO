import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PendingIndicatorProps {
  show?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export function PendingIndicator({ 
  show = true, 
  className,
  size = "sm",
  pulse = true
}: PendingIndicatorProps) {
  if (!show) return null;

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3"
  };

  return (
    <motion.span
      className={cn(
        "inline-block rounded-full bg-red-500",
        sizeClasses[size],
        className
      )}
      animate={pulse ? {
        scale: [1, 1.2, 1],
        opacity: [1, 0.7, 1],
      } : undefined}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      data-testid="pending-indicator"
    />
  );
}

interface PendingBadgeProps {
  count: number;
  showIndicator?: boolean;
  className?: string;
}

export function PendingBadge({ count, showIndicator = true, className }: PendingBadgeProps) {
  if (count === 0) return null;

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
        {count}
      </span>
      {showIndicator && (
        <PendingIndicator 
          className="absolute -top-0.5 -right-0.5" 
          size="sm"
        />
      )}
    </span>
  );
}
