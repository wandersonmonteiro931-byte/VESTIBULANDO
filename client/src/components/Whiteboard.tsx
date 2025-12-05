import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Pencil, 
  Eraser, 
  Square, 
  Circle, 
  Type, 
  Trash2, 
  Download,
  Undo,
  Redo,
  Image as ImageIcon,
  Palette,
  Minus
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface WhiteboardProps {
  onDataChange?: (data: string) => void;
  initialData?: string;
  readOnly?: boolean;
  className?: string;
}

interface DrawAction {
  type: "stroke" | "text" | "image" | "shape" | "clear";
  data: any;
}

const COLORS = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", 
  "#ffff00", "#ff00ff", "#00ffff", "#ff8000", "#8000ff",
  "#008000", "#800000", "#000080", "#808080", "#c0c0c0"
];

export function Whiteboard({ onDataChange, initialData, readOnly = false, className = "" }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pencil" | "eraser" | "line" | "rectangle" | "circle" | "text">("pencil");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const saveToHistory = useCallback(() => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [getContext, history, historyIndex]);

  const exportData = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    const tempCanvas = document.createElement("canvas");
    const maxSize = 800;
    const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height, 1);
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL("image/jpeg", 0.5);
  }, []);

  const debouncedSave = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (onDataChange && !readOnly && historyIndex >= 0) {
      if (debouncedSave.current) {
        clearTimeout(debouncedSave.current);
      }
      debouncedSave.current = setTimeout(() => {
        const data = exportData();
        if (data.length < 900000) {
          onDataChange(data);
        } else {
          console.warn("Whiteboard data too large for Firestore, skipping save");
        }
      }, 1000);
    }
    return () => {
      if (debouncedSave.current) {
        clearTimeout(debouncedSave.current);
      }
    };
  }, [historyIndex, onDataChange, readOnly, exportData]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentData.width > 0 && currentData.height > 0) {
      ctx.putImageData(currentData, 0, 0);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    if (initialData) {
      const canvas = canvasRef.current;
      const ctx = getContext();
      if (!canvas || !ctx) return;

      const img = new window.Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveToHistory();
      };
      img.src = initialData;
    } else {
      const ctx = getContext();
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
      }
    }
  }, [initialData, getContext, saveToHistory]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    lastPointRef.current = point;
    startPointRef.current = point;

    const ctx = getContext();
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    if (tool === "pencil" || tool === "eraser") {
      const ctx = getContext();
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? brushSize * 3 : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;

    const point = getCanvasPoint(e);
    const ctx = getContext();
    const canvas = canvasRef.current;
    
    if (!ctx || !canvas) return;

    if (tool === "pencil" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current?.x || point.x, lastPointRef.current?.y || point.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? brushSize * 3 : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      lastPointRef.current = point;
    } else if (tool === "line" || tool === "rectangle" || tool === "circle") {
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const start = startPointRef.current;
      if (!start) return;

      if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else if (tool === "rectangle") {
        ctx.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
      } else if (tool === "circle") {
        const radius = Math.sqrt(Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPointRef.current = null;
      startPointRef.current = null;
      snapshotRef.current = null;
      saveToHistory();
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const ctx = getContext();
      if (!ctx) return;
      
      const newIndex = historyIndex - 1;
      ctx.putImageData(history[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const ctx = getContext();
      if (!ctx) return;
      
      const newIndex = historyIndex + 1;
      ctx.putImageData(history[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const clearCanvas = () => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `quadro-branco-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const ctx = getContext();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

        const scale = Math.min(
          (canvas.width * 0.8) / img.width,
          (canvas.height * 0.8) / img.height,
          1
        );
        
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;

        ctx.drawImage(img, x, y, width, height);
        saveToHistory();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {!readOnly && (
        <div className="flex items-center gap-1 p-2 bg-card border-b flex-wrap">
          <Button
            size="icon"
            variant={tool === "pencil" ? "default" : "ghost"}
            onClick={() => setTool("pencil")}
            data-testid="button-tool-pencil"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant={tool === "eraser" ? "default" : "ghost"}
            onClick={() => setTool("eraser")}
            data-testid="button-tool-eraser"
          >
            <Eraser className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant={tool === "line" ? "default" : "ghost"}
            onClick={() => setTool("line")}
            data-testid="button-tool-line"
          >
            <Minus className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant={tool === "rectangle" ? "default" : "ghost"}
            onClick={() => setTool("rectangle")}
            data-testid="button-tool-rectangle"
          >
            <Square className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant={tool === "circle" ? "default" : "ghost"}
            onClick={() => setTool("circle")}
            data-testid="button-tool-circle"
          >
            <Circle className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-color-picker">
                <div 
                  className="h-5 w-5 rounded border"
                  style={{ backgroundColor: color }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-6 w-6 rounded border-2 ${color === c ? "border-primary" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    data-testid={`button-color-${c}`}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-brush-size">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tamanho: {brushSize}px</p>
                <Slider
                  value={[brushSize]}
                  onValueChange={(v) => setBrushSize(v[0])}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-6 w-px bg-border mx-1" />

          <Button
            size="icon"
            variant="ghost"
            onClick={undo}
            disabled={historyIndex <= 0}
            data-testid="button-undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            data-testid="button-redo"
          >
            <Redo className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <label>
            <Button size="icon" variant="ghost" asChild data-testid="button-add-image">
              <span>
                <ImageIcon className="h-4 w-4" />
              </span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>

          <Button
            size="icon"
            variant="ghost"
            onClick={clearCanvas}
            data-testid="button-clear-canvas"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={downloadCanvas}
            data-testid="button-download-canvas"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${readOnly ? "cursor-default" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}
