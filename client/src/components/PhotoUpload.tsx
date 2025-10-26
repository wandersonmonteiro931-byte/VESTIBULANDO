import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ImageEditor from "./ImageEditor";

interface PhotoUploadProps {
  onPhotoChange: (file: File | null, base64?: string | null) => void;
  onPublicChange: (isPublic: boolean) => void;
  required?: boolean;
  label?: string;
}

export function PhotoUpload({ 
  onPhotoChange, 
  onPublicChange, 
  required = false,
  label = "Foto (Opcional)"
}: PhotoUploadProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const compressImage = (file: File): Promise<{ file: File; base64: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Redimensionar de forma mais agressiva para mobile (800x800 em vez de maiores)
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
          
          // Converter para blob e base64 com compressão maior para mobile (60% de qualidade)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Não foi possível comprimir a imagem'));
                return;
              }
              
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              const base64 = canvas.toDataURL('image/jpeg', 0.6);
              resolve({ file: compressedFile, base64 });
            },
            'image/jpeg',
            0.6
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
        description: "A foto deve ter no máximo 50MB. Por favor, tire uma foto com qualidade menor.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageToEdit(dataUrl);
      setShowEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const handleEditorComplete = async (croppedBlob: Blob) => {
    try {
      setIsCompressing(true);
      
      const croppedFile = new File([croppedBlob], 'cropped-image.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      const { file: compressedFile, base64 } = await compressImage(croppedFile);
      
      setPhotoPreview(base64);
      setPhotoFile(compressedFile);
      onPhotoChange(compressedFile, base64);
      onPublicChange(true);
      setShowEditor(false);
      setImageToEdit(null);
      setIsCompressing(false);
    } catch (error) {
      console.error('Erro ao comprimir imagem:', error);
      setIsCompressing(false);
      setShowEditor(false);
      setImageToEdit(null);
      toast({
        title: "Erro ao processar imagem",
        description: "Não foi possível comprimir a imagem. Tente tirar uma foto com qualidade menor.",
        variant: "destructive",
      });
    }
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setImageToEdit(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    onPhotoChange(null, null);
    // Definir como não pública quando a foto é removida
    onPublicChange(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
      
      <div className="space-y-4" data-testid="photo-upload-container">
        <div className="space-y-2">
          <Label>
            {label} {required && <span className="text-destructive">*</span>}
          </Label>
          
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-dashed border-muted-foreground/30">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} alt="Preview" className="object-cover" />
                ) : (
                  <AvatarFallback>
                    <Camera className="h-10 w-10 text-muted-foreground" />
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
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-photo-file"
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                disabled={isCompressing}
                data-testid="button-upload-photo"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isCompressing ? "Processando..." : (photoFile ? "Trocar foto" : "Selecionar foto")}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Formato: JPG, PNG, etc. Tamanho máximo: 50MB
              </p>
            </div>
          </div>
        </div>

        {!photoFile && required && (
          <p className="text-xs text-destructive" data-testid="text-photo-required">
            A foto é obrigatória
          </p>
        )}
      </div>
    </>
  );
}
