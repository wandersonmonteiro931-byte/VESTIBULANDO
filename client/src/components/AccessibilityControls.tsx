import { useEffect, useState } from "react";
import { Accessibility, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AccessibilityPreferences {
  scale: "100" | "112" | "125";
  highContrast: boolean;
  reduceMotion: boolean;
  readableFont: boolean;
}

const defaults: AccessibilityPreferences = { scale: "100", highContrast: false, reduceMotion: false, readableFont: false };
const storageKey = "vestibulando-accessibility-v1";

function readPreferences(): AccessibilityPreferences {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; }
  catch { return defaults; }
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.dataset.a11yScale = preferences.scale;
  root.classList.toggle("a11y-high-contrast", preferences.highContrast);
  root.classList.toggle("a11y-reduce-motion", preferences.reduceMotion);
  root.classList.toggle("a11y-readable-font", preferences.readableFont);
}

export function AccessibilityPreferencesLoader() {
  useEffect(() => applyPreferences(readPreferences()), []);
  return null;
}

export function AccessibilityControls() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(readPreferences);
  const [open, setOpen] = useState(false);
  const update = (next: AccessibilityPreferences) => { setPreferences(next); applyPreferences(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const reset = () => update(defaults);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="icon" className="header-icon-btn" aria-label="Preferências de acessibilidade"><Accessibility className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Preferências de acessibilidade</DialogTitle><DialogDescription>As escolhas são aplicadas imediatamente e ficam salvas neste dispositivo.</DialogDescription></DialogHeader>
        <div className="school-a11y-controls">
          <div><Label htmlFor="a11y-scale">Tamanho do texto</Label><Select value={preferences.scale} onValueChange={(scale: AccessibilityPreferences["scale"]) => update({ ...preferences, scale })}><SelectTrigger id="a11y-scale"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="100">Padrão · 100%</SelectItem><SelectItem value="112">Ampliado · 112%</SelectItem><SelectItem value="125">Extra grande · 125%</SelectItem></SelectContent></Select></div>
          <label><Checkbox checked={preferences.highContrast} onCheckedChange={(checked) => update({ ...preferences, highContrast: checked === true })} /><span><strong>Alto contraste</strong><small>Reforça bordas, textos e indicadores.</small></span></label>
          <label><Checkbox checked={preferences.reduceMotion} onCheckedChange={(checked) => update({ ...preferences, reduceMotion: checked === true })} /><span><strong>Reduzir movimentos</strong><small>Desativa animações e transições decorativas.</small></span></label>
          <label><Checkbox checked={preferences.readableFont} onCheckedChange={(checked) => update({ ...preferences, readableFont: checked === true })} /><span><strong>Fonte de alta legibilidade</strong><small>Usa espaçamento e formas mais simples.</small></span></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button><Button onClick={() => setOpen(false)}><Check className="mr-2 h-4 w-4" />Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
