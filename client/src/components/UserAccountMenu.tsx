import { useState } from "react";
import { Settings, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditProfileDialog from "./EditProfileDialog";

interface UserAccountMenuProps {
  onClose?: () => void;
  variant?: "avatar" | "settings";
}

export default function UserAccountMenu({ onClose, variant = "avatar" }: UserAccountMenuProps) {
  const { userData, refreshUserData } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getInitials = (nome: string) => {
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const handleUpdate = async () => {
    await refreshUserData();
    setIsDialogOpen(false);
    onClose?.();
  };

  if (!userData) return null;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            size={variant === "settings" ? "sm" : "icon"}
            variant="ghost"
            className={variant === "settings" ? "portal-profile-action" : "rounded-full"}
            data-testid="button-user-account"
          >
            {variant === "settings" ? (
              <>
                <Settings aria-hidden="true" />
                <span>CONFIGURAÇÕES</span>
              </>
            ) : (
              <Avatar className="h-8 w-8">
                {(userData?.fotoUrl || userData?.fotoBase64) && userData?.fotoPublica ? (
                  <AvatarImage src={userData.fotoUrl || userData.fotoBase64} alt={userData.nome} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {getInitials(userData.nome)}
                </AvatarFallback>
              </Avatar>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]" sideOffset={8}>
          <DropdownMenuItem onClick={() => setIsDialogOpen(true)} className="cursor-pointer">
            <UserIcon className="h-4 w-4 mr-2" />
            Editar Perfil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isDialogOpen && (
        <EditProfileDialog
          user={userData}
          onClose={() => setIsDialogOpen(false)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
