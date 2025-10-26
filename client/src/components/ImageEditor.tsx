import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw, ZoomIn, Check, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ImageEditorProps {
  image: string;
  onComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CroppedAreaPixels extends Area {}

export default function ImageEditor({ 
  image, 
  onComplete, 
  onCancel,
  aspectRatio = 1 
}: ImageEditorProps) {
  console.log('🎨 ImageEditor renderizado!');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: CroppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: CroppedAreaPixels,
    rotation = 0
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Não foi possível criar contexto do canvas');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao criar blob da imagem'));
          }
        },
        'image/jpeg',
        0.8
      );
    });
  };

  const handleComplete = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      onComplete(croppedImage);
    } catch (e) {
      console.error('Erro ao processar imagem:', e);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 shrink-0">
          <CardTitle>Editar Imagem</CardTitle>
          <Button size="icon" variant="ghost" onClick={onCancel} data-testid="button-close-editor">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 p-0 relative bg-black min-h-[300px] md:min-h-[400px]">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </CardContent>

        <Separator />

        <div className="p-4 space-y-4 shrink-0 bg-background">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                Zoom
              </Label>
              <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
              data-testid="slider-zoom"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <RotateCw className="h-4 w-4" />
              Rotação: {rotation}°
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              data-testid="button-rotate"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Girar 90°
            </Button>
          </div>
        </div>

        <Separator />

        <CardFooter className="flex gap-2 p-4 shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            data-testid="button-cancel-edit"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleComplete}
            className="flex-1"
            data-testid="button-apply-edit"
          >
            <Check className="h-4 w-4 mr-2" />
            Aplicar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
