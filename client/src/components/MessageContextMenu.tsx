import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageContextMenuProps {
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  position: { x: number; y: number };
  canDeleteForEveryone: boolean;
  isVisible: boolean;
}

export function MessageContextMenu({
  onDeleteForMe,
  onDeleteForEveryone,
  position,
  canDeleteForEveryone,
  isVisible,
}: MessageContextMenuProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      data-testid="message-context-menu"
    >
      <div className="flex flex-col">
        <Button
          variant="ghost"
          className="justify-start gap-2 rounded-none hover-elevate"
          onClick={onDeleteForMe}
          data-testid="button-delete-for-me"
        >
          <Trash2 className="h-4 w-4" />
          Excluir para mim
        </Button>
        
        {canDeleteForEveryone && (
          <Button
            variant="ghost"
            className="justify-start gap-2 rounded-none text-destructive hover:text-destructive hover-elevate"
            onClick={onDeleteForEveryone}
            data-testid="button-delete-for-everyone"
          >
            <Trash2 className="h-4 w-4" />
            Excluir para todos
          </Button>
        )}
      </div>
    </div>
  );
}
