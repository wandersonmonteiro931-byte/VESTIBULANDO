import { useRef, useState } from "react";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  selectedFile: File | null;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

export function FileUploadZone({
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept = "*/*",
  maxSize = 10 * 1024 * 1024,
  disabled = false,
}: FileUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
      console.error(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      const errorEvent = new CustomEvent('file-upload-error', {
        detail: { 
          message: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`,
          file: file.name,
          size: file.size 
        }
      });
      window.dispatchEvent(errorEvent);
      return;
    }
    
    if (accept !== "*/*") {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type.toLowerCase();
      
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return type.toLowerCase() === fileExtension;
        }
        return mimeType.startsWith(type.replace('*', ''));
      });
      
      if (!isAccepted) {
        console.error(`Invalid file type: ${file.name} (${file.type})`);
        const errorEvent = new CustomEvent('file-upload-error', {
          detail: { 
            message: `Tipo de arquivo não permitido. Tipos aceitos: ${accept}`,
            file: file.name,
            type: file.type 
          }
        });
        window.dispatchEvent(errorEvent);
        return;
      }
    }
    
    onFileSelect(file);
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        accept={accept}
        disabled={disabled}
        data-testid="input-file"
      />

      {!selectedFile ? (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover-elevate"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          data-testid="zone-file-upload"
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-base font-medium mb-1">
            Arraste e solte seu arquivo aqui
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Tamanho máximo: {maxSize / 1024 / 1024}MB
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-card" data-testid="file-selected">
          <File className="h-10 w-10 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onFileRemove();
            }}
            disabled={disabled}
            data-testid="button-remove-file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
