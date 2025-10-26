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
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { User } from "@shared/schema";
import ImageEditor from "./ImageEditor";

interface EditProfileDialogProps {
  user: User;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditProfileDialog({ user, onClose, onUpdate }: EditProfileDialogProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(user.fotoUrl || user.fotoBase64 || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(user.fotoPublica || false);
  const [statusText, setStatusText] = useState(user.mensagemStatus || "");
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const { toast } = useToast();

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar de forma mais agressiva para mobile (800x800 em vez de 1200x1200)
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Converter para blob com compressão maior para mobile (60% em vez de 80%)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Não foi possível comprimir a imagem'));
                return;
              }
              
              // Criar novo File a partir do Blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              resolve(compressedFile);
            },
            'image/jpeg',
            0.6 // 60% de qualidade para melhor compressão
          );
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A foto deve ter no máximo 50MB. Por favor, tire uma foto com qualidade menor ou use outra imagem.",
        variant: "destructive",
      });
      return;
    }

    console.log('📸 Preparando para abrir editor de fotos...');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      console.log('📸 Imagem carregada, abrindo editor...', { dataUrlLength: dataUrl.length });
      setImageToEdit(dataUrl);
      setShowEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const handleEditorComplete = async (croppedBlob: Blob) => {
    try {
      setSaving(true);
      
      const croppedFile = new File([croppedBlob], 'cropped-image.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      const compressedFile = await compressImage(croppedFile);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPhotoPreview(dataUrl);
        setPhotoFile(compressedFile);
        setShowEditor(false);
        setImageToEdit(null);
        setSaving(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      setSaving(false);
      setShowEditor(false);
      setImageToEdit(null);
      toast({
        title: "Erro ao processar imagem",
        description: "Não foi possível processar a imagem editada.",
        variant: "destructive",
      });
    }
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setImageToEdit(null);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
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
      let fotoUrl: string | null = user.fotoUrl || null;

      // Se há uma nova foto para fazer upload
      if (photoFile) {
        // Criar referência no Firebase Storage
        // Sempre usar .jpg pois a compressão converte para JPEG
        const timestamp = Date.now();
        const fileName = `profile_${user.uid}_${timestamp}.jpg`;
        const storageRef = ref(storage, `usuarios/fotos/${fileName}`);

        // Fazer upload da imagem
        await uploadBytes(storageRef, photoFile);

        // Obter URL de download
        fotoUrl = await getDownloadURL(storageRef);

        // Se havia uma foto antiga com URL do Storage, tentar deletar
        if (user.fotoUrl && user.fotoUrl.includes('firebasestorage.googleapis.com')) {
          try {
            // Criar referência a partir da URL completa do Storage
            const urlParts = user.fotoUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
              const filePath = decodeURIComponent(urlParts);
              const oldPhotoRef = ref(storage, filePath);
              await deleteObject(oldPhotoRef);
            }
          } catch (deleteError) {
            console.warn("Não foi possível deletar foto antiga:", deleteError);
          }
        }
      }

      const userRef = doc(db, "usuarios", user.uid);
      const updateData: any = {
        mensagemStatus: statusText || null,
      };
      
      // Se o usuário removeu a foto (não há preview)
      if (!photoPreview && (user.fotoUrl || user.fotoBase64)) {
        // Deletar foto do Storage se existir
        if (user.fotoUrl && user.fotoUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const urlParts = user.fotoUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
              const filePath = decodeURIComponent(urlParts);
              const oldPhotoRef = ref(storage, filePath);
              await deleteObject(oldPhotoRef);
            }
          } catch (deleteError) {
            console.warn("Não foi possível deletar foto antiga:", deleteError);
          }
        }
        
        // Remover ambos os campos de foto
        updateData.fotoUrl = deleteField();
        updateData.fotoBase64 = deleteField();
        updateData.fotoPublica = false;
      }
      // Se fez upload de nova foto
      else if (photoFile) {
        updateData.fotoUrl = fotoUrl;
        updateData.fotoBase64 = deleteField(); // Remove base64 legado
        updateData.fotoPublica = isPublic;
      }
      // Se apenas mudou a visibilidade da foto existente
      else if (photoPreview) {
        updateData.fotoPublica = isPublic;
      }
      
      await updateDoc(userRef, updateData);

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

  console.log('📸 EditProfileDialog render - showEditor:', showEditor, 'hasImage:', !!imageToEdit);

  return (
    <>
      {showEditor && imageToEdit && (
        <ImageEditor
          image={imageToEdit}
          onComplete={handleEditorComplete}
          onCancel={handleEditorCancel}
          aspectRatio={1}
        />
      )}
      
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
                  {photoPreview ? "Trocar foto" : "Selecionar foto"}
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Formato: JPG, PNG. A imagem será automaticamente otimizada.
                </p>
              </div>
            </div>

            {photoPreview && (
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
    </>
  );
}
