import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  onPhotoChange: (file: File | null) => void;
  onPublicChange: (isPublic: boolean) => void;
  initialPublic?: boolean;
  required?: boolean;
  label?: string;
}

export function PhotoUpload({ 
  onPhotoChange, 
  onPublicChange, 
  initialPublic = false,
  required = false,
  label = "Foto 3x4"
}: PhotoUploadProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(initialPublic);
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

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A foto deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setPhotoFile(file);
    onPhotoChange(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    onPhotoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePublicToggle = (checked: boolean) => {
    setIsPublic(checked);
    onPublicChange(checked);
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
              Formato: JPG, PNG, etc. Tamanho máximo: 5MB
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
        <div className="flex-1">
          <Label htmlFor="photo-public" className="text-sm font-medium cursor-pointer">
            Tornar foto pública
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            {isPublic 
              ? "Sua foto será visível para todos os usuários da plataforma"
              : "Sua foto será visível apenas para a diretoria (para documentação)"}
          </p>
        </div>
        <Switch
          id="photo-public"
          checked={isPublic}
          onCheckedChange={handlePublicToggle}
          data-testid="switch-photo-public"
        />
      </div>

      {!photoFile && required && (
        <p className="text-xs text-destructive" data-testid="text-photo-required">
          A foto é obrigatória
        </p>
      )}
    </div>
  );
}
