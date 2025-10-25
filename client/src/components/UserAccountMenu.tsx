import { useState, useRef } from "react";
import { User as UserIcon, Camera, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserAccountMenuProps {
  onClose?: () => void;
}

export default function UserAccountMenu({ onClose }: UserAccountMenuProps) {
  const { userData, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState(userData?.mensagemStatus || "");
  const [fotoPublica, setFotoPublica] = useState(userData?.fotoPublica || false);
  const [saving, setSaving] = useState(false);

  const getInitials = (nome: string) => {
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const handleSave = async () => {
    if (!userData?.uid) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "usuarios", userData.uid), {
        mensagemStatus: mensagemStatus.trim() || null,
        fotoPublica: fotoPublica,
      });

      await refreshUserData();

      toast({
        title: "Perfil atualizado",
        description: "Suas alterações foram salvas com sucesso.",
      });

      setIsDialogOpen(false);
      onClose?.();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar seu perfil. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            data-testid="button-user-account"
          >
            <Avatar className="h-8 w-8">
              {(userData?.fotoUrl || userData?.fotoBase64) && userData?.fotoPublica ? (
                <AvatarImage src={userData.fotoUrl || userData.fotoBase64} alt={userData.nome} />
              ) : null}
              <AvatarFallback className="text-xs">
                {userData ? getInitials(userData.nome) : "?"}
              </AvatarFallback>
            </Avatar>
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
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setIsDialogOpen(false)}
          />
          
          <Card className="relative w-full max-w-md z-10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Editar Perfil</CardTitle>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-close-profile-edit"
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            
            <Separator />
            
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24">
                  {(userData?.fotoUrl || userData?.fotoBase64) ? (
                    <AvatarImage src={userData.fotoUrl || userData.fotoBase64} alt={userData?.nome} />
                  ) : null}
                  <AvatarFallback className="text-2xl">
                    {userData ? getInitials(userData.nome) : "?"}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xs text-muted-foreground mt-2">
                  Use o botão "Editar Perfil" no chat para alterar sua foto
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    id="fotoPublica"
                    checked={fotoPublica}
                    onChange={(e) => setFotoPublica(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="fotoPublica" className="text-sm cursor-pointer">
                    Tornar foto visível publicamente
                  </Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="mensagemStatus">Status (mensagem pública)</Label>
                <Textarea
                  id="mensagemStatus"
                  placeholder="Ex: Estudando para o ENEM..."
                  value={mensagemStatus}
                  onChange={(e) => setMensagemStatus(e.target.value)}
                  maxLength={30}
                  rows={2}
                  data-testid="input-status-message"
                />
                <p className="text-xs text-muted-foreground">
                  {mensagemStatus.length}/30 caracteres
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-save-profile"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
