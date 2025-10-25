import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { X, Upload, Camera, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@shared/schema";

interface EditProfileDialogProps {
  user: User;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditProfileDialog({ user, onClose, onUpdate }: EditProfileDialogProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(user.fotoBase64 || null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(user.fotoBase64 || null);
  const [isPublic, setIsPublic] = useState(user.fotoPublica || false);
  const [statusText, setStatusText] = useState(user.mensagemStatus || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A foto deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPhotoPreview(base64);
      setPhotoBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBase64(null);
  };

  const handleSave = async () => {
    if (statusText && statusText.length > 30) {
      toast({
        title: "Status muito longo",
        description: "O status deve ter no máximo 30 caracteres",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const userRef = doc(db, "usuarios", user.uid);
      await updateDoc(userRef, {
        fotoBase64: photoBase64 || null,
        fotoPublica: photoBase64 ? isPublic : false,
        mensagemStatus: statusText || null,
      });

      toast({
        title: "Perfil atualizado",
        description: "Suas alterações foram salvas com sucesso",
      });

      onUpdate();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o perfil. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (nome: string) => {
    const names = nome.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <Card className="relative w-full max-w-md max-h-[90vh] z-10 flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 shrink-0">
          <CardTitle>Editar Perfil</CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-edit-profile">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <Label>Foto de Perfil</Label>
            
            <div className="flex items-start gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-dashed border-muted-foreground/30">
                  {photoPreview ? (
                    <AvatarImage src={photoPreview} alt="Preview" className="object-cover" />
                  ) : (
                    <AvatarFallback className="text-2xl">
                      {getInitials(user.nome)}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                {photoPreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemovePhoto}
                    data-testid="button-remove-photo"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-upload-input"
                  data-testid="input-photo-file"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('photo-upload-input')?.click()}
                  className="w-full"
                  data-testid="button-upload-photo"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {photoBase64 ? "Trocar foto" : "Selecionar foto"}
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Formato: JPG, PNG. Máximo: 5MB
                </p>
              </div>
            </div>

            {photoBase64 && (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <Label htmlFor="photo-public" className="text-sm font-medium cursor-pointer">
                    Tornar foto pública
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isPublic 
                      ? "Sua foto será visível para todos no chat"
                      : "Sua foto será visível apenas para a diretoria"}
                  </p>
                </div>
                <Switch
                  id="photo-public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  data-testid="switch-photo-public"
                />
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="status-text">
              Status Personalizado (opcional)
            </Label>
            <Input
              id="status-text"
              placeholder="Ex: Estudando para o ENEM..."
              value={statusText}
              onChange={(e) => setStatusText(e.target.value.slice(0, 30))}
              maxLength={30}
              data-testid="input-status-text"
            />
            <p className="text-xs text-muted-foreground">
              {statusText.length}/30 caracteres
            </p>
          </div>
        </CardContent>

        <div className="flex gap-2 p-6 pt-4 border-t bg-background shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={saving}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={saving}
            data-testid="button-save-profile"
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
