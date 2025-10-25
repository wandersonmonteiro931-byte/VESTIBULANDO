import { X, Camera, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface ProfileEditDialogProps {
  onClose: () => void;
}

export default function ProfileEditDialog({ onClose }: ProfileEditDialogProps) {
  const { userData, refreshUserData } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mensagemStatus, setMensagemStatus] = useState(userData?.mensagemStatus || "");
  const [fotoBase64, setFotoBase64] = useState(userData?.fotoBase64 || "");
  const [isLoading, setIsLoading] = useState(false);

  const getInitials = (nome: string, tipo?: string) => {
    if (tipo === "diretor" || nome === "Diretoria") return "DIR";
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    return userData?.tipo === "diretor" ? "Diretoria" : userData?.nome || "";
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setFotoBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!userData?.uid) return;

    setIsLoading(true);
    try {
      const userRef = doc(db, "usuarios", userData.uid);
      await updateDoc(userRef, {
        mensagemStatus: mensagemStatus.trim() || "",
        fotoBase64: fotoBase64,
        fotoPublica: true,
      });

      await refreshUserData();

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!",
      });

      onClose();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userData) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <Card className="relative w-full max-w-md z-10">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle>Editar Perfil</CardTitle>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onClose} 
            data-testid="button-close-edit-profile"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {fotoBase64 ? (
                  <AvatarImage src={fotoBase64} alt={getDisplayName()} />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {getInitials(userData.nome, userData.tipo)}
                </AvatarFallback>
              </Avatar>
              
              <Button
                size="icon"
                variant="default"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-lg"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-change-photo"
              >
                <Camera className="h-4 w-4" />
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            
            <h3 className="text-xl font-semibold text-center mt-3">{getDisplayName()}</h3>
            <p className="text-sm text-muted-foreground">{userData.email}</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recado">Recado (Mensagem de Status)</Label>
              <Textarea
                id="recado"
                placeholder="Digite seu recado ou mensagem de status..."
                value={mensagemStatus}
                onChange={(e) => setMensagemStatus(e.target.value)}
                maxLength={200}
                className="resize-none"
                rows={3}
                data-testid="textarea-status-message"
              />
              <p className="text-xs text-muted-foreground">
                {mensagemStatus.length}/200 caracteres
              </p>
            </div>

            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                Sua foto de perfil e recado serão visíveis para todos os usuários do sistema.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={isLoading}
              data-testid="button-save-profile"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
