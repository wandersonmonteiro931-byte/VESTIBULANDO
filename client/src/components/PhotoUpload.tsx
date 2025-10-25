import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A foto deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    // Criar preview e converter para Base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPhotoPreview(base64);
      setPhotoFile(file);
      // Passar tanto o file quanto o base64 para o componente pai
      onPhotoChange(file, base64);
      // Automaticamente definir como pública quando uma foto é enviada
      onPublicChange(true);
    };
    reader.readAsDataURL(file);
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
              data-testid="button-upload-photo"
            >
              <Upload className="h-4 w-4 mr-2" />
              {photoFile ? "Trocar foto" : "Selecionar foto"}
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Formato: JPG, PNG, etc. Tamanho máximo: 10MB
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
  );
}
