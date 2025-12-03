import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Ban, Trash2, AlertTriangle, Unlock } from "lucide-react";

interface ConversationOptionsMenuProps {
  onBlock: () => void;
  onUnblock?: () => void;
  onDelete: () => void;
  onReport: () => void;
  isBlocked?: boolean;
  iBlockedOther?: boolean;
}

export function ConversationOptionsMenu({
  onBlock,
  onUnblock,
  onDelete,
  onReport,
  isBlocked,
  iBlockedOther,
}: ConversationOptionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="text-white hover:bg-white/10 shrink-0 h-9 w-9"
          data-testid="button-more-options"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {iBlockedOther ? (
          <DropdownMenuItem
            onClick={onUnblock}
            className="gap-2 cursor-pointer text-green-600 focus:text-green-600"
            data-testid="menu-item-unblock"
          >
            <Unlock className="h-4 w-4" />
            Desbloquear
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onBlock}
            className="gap-2 cursor-pointer"
            data-testid="menu-item-block"
          >
            <Ban className="h-4 w-4" />
            Bloquear
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          data-testid="menu-item-delete"
        >
          <Trash2 className="h-4 w-4" />
          Excluir conversa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onReport}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          data-testid="menu-item-report"
        >
          <AlertTriangle className="h-4 w-4" />
          Denunciar conversa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
