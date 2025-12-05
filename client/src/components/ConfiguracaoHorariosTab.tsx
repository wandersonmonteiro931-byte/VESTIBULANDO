import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { 
  type HorarioAula,
  type ConfiguracaoHorarios,
  HORARIOS_AULAS_PADRAO,
  DIAS_SEMANA,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Clock, 
  Save,
  Trash2,
  Edit,
  RotateCcw,
  Settings,
  Calendar,
  Coffee,
  BookOpen,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { cn } from "@/lib/utils";

const DIAS_LABELS: Record<string, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

export function ConfiguracaoHorariosTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [horarios, setHorarios] = useState<HorarioAula[]>([]);
  const [diasAtivos, setDiasAtivos] = useState<string[]>(["segunda", "terca", "quarta", "quinta", "sexta"]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioAula | null>(null);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: configs, isLoading: loadingConfigs, refetch: refetchConfigs } = useRealtimeQuery<ConfiguracaoHorarios>({
    collectionName: "configuracaoHorarios",
    queryKey: ["configuracaoHorarios"],
  });

  useEffect(() => {
    if (configs && configs.length > 0) {
      const activeConfig = configs.find(c => c.ativo) || configs[0];
      setHorarios(activeConfig.horarios || []);
      setDiasAtivos(activeConfig.diasAtivos || ["segunda", "terca", "quarta", "quinta", "sexta"]);
      setConfigId(activeConfig.id);
    } else if (!loadingConfigs && (!configs || configs.length === 0)) {
      setHorarios([...HORARIOS_AULAS_PADRAO]);
      setDiasAtivos(["segunda", "terca", "quarta", "quinta", "sexta"]);
    }
  }, [configs, loadingConfigs]);

  const handleAddHorario = () => {
    const lastHorario = horarios.filter(h => h.tipo === "aula").slice(-1)[0];
    const newId = (Math.max(...horarios.map(h => parseInt(h.id.replace(/\D/g, '') || '0'))) + 1).toString();
    const newHorario: HorarioAula = {
      id: newId,
      nome: `${horarios.filter(h => h.tipo === "aula").length + 1}ª Aula`,
      inicio: lastHorario?.fim || "08:00",
      fim: addMinutesToTime(lastHorario?.fim || "08:00", 50),
      tipo: "aula",
      ativo: true,
    };
    setEditingHorario(newHorario);
    setEditDialogOpen(true);
  };

  const handleAddIntervalo = () => {
    const lastHorario = horarios.slice(-1)[0];
    const newId = `i${Math.max(...horarios.filter(h => h.id.startsWith('i')).map(h => parseInt(h.id.replace('i', '') || '0')), 0) + 1}`;
    const newHorario: HorarioAula = {
      id: newId,
      nome: "Intervalo",
      inicio: lastHorario?.fim || "10:00",
      fim: addMinutesToTime(lastHorario?.fim || "10:00", 15),
      tipo: "intervalo",
      ativo: true,
    };
    setEditingHorario(newHorario);
    setEditDialogOpen(true);
  };

  const handleEditHorario = (horario: HorarioAula) => {
    setEditingHorario({ ...horario });
    setEditDialogOpen(true);
  };

  const handleSaveHorario = () => {
    if (!editingHorario) return;

    const exists = horarios.find(h => h.id === editingHorario.id);
    if (exists) {
      setHorarios(prev => prev.map(h => h.id === editingHorario.id ? editingHorario : h));
    } else {
      setHorarios(prev => [...prev, editingHorario]);
    }
    
    setHasChanges(true);
    setEditDialogOpen(false);
    setEditingHorario(null);
  };

  const handleDeleteHorario = (id: string) => {
    setHorarios(prev => prev.filter(h => h.id !== id));
    setHasChanges(true);
  };

  const handleMoveHorario = (id: string, direction: "up" | "down") => {
    const index = horarios.findIndex(h => h.id === id);
    if (index === -1) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= horarios.length) return;
    
    const newHorarios = [...horarios];
    [newHorarios[index], newHorarios[newIndex]] = [newHorarios[newIndex], newHorarios[index]];
    setHorarios(newHorarios);
    setHasChanges(true);
  };

  const handleToggleDia = (dia: string) => {
    setDiasAtivos(prev => {
      if (prev.includes(dia)) {
        return prev.filter(d => d !== dia);
      } else {
        return [...prev, dia];
      }
    });
    setHasChanges(true);
  };

  const handleResetToDefault = () => {
    if (!confirm("Deseja restaurar os horários para a configuração padrão?")) return;
    setHorarios([...HORARIOS_AULAS_PADRAO]);
    setDiasAtivos(["segunda", "terca", "quarta", "quinta", "sexta"]);
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    if (!userData) return;

    setSaving(true);
    try {
      const configData = {
        horarios,
        diasAtivos,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      if (configId) {
        await updateDoc(doc(db, "configuracaoHorarios", configId), configData);
      } else {
        const newDoc = await addDoc(collection(db, "configuracaoHorarios"), {
          ...configData,
          nome: "Padrão",
          ativo: true,
          criadoPor: userData.uid,
          criadoPorNome: userData.nome,
          dataCriacao: getNowBrasiliaISO(),
        });
        setConfigId(newDoc.id);
      }

      toast({
        title: "Configuração salva!",
        description: "Os horários foram atualizados com sucesso.",
      });
      setHasChanges(false);
      refetchConfigs();
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração de horários.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addMinutesToTime = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
  };

  const getTotalAulas = () => horarios.filter(h => h.tipo === "aula" && h.ativo).length;
  const getTotalIntervalos = () => horarios.filter(h => h.tipo === "intervalo" && h.ativo).length;

  if (loadingConfigs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração de Horários
          </h3>
          <p className="text-sm text-muted-foreground">
            Defina os horários de início e fim de cada aula
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleResetToDefault} data-testid="button-reset-horarios">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button 
            onClick={handleSaveConfig} 
            disabled={!hasChanges || saving}
            data-testid="button-save-config"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dias da Semana Ativos
          </CardTitle>
          <CardDescription>
            Selecione os dias em que haverá aulas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {DIAS_SEMANA.map(dia => (
              <div key={dia} className="flex items-center space-x-2">
                <Checkbox
                  id={`dia-${dia}`}
                  checked={diasAtivos.includes(dia)}
                  onCheckedChange={() => handleToggleDia(dia)}
                  data-testid={`checkbox-dia-${dia}`}
                />
                <Label htmlFor={`dia-${dia}`} className="cursor-pointer">
                  {DIAS_LABELS[dia]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horários de Aula
              </CardTitle>
              <CardDescription>
                {getTotalAulas()} aulas e {getTotalIntervalos()} intervalos configurados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleAddIntervalo} data-testid="button-add-intervalo">
                <Coffee className="h-4 w-4 mr-2" />
                Intervalo
              </Button>
              <Button size="sm" onClick={handleAddHorario} data-testid="button-add-horario">
                <Plus className="h-4 w-4 mr-2" />
                Aula
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {horarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum horário configurado. Clique em "Aula" ou "Intervalo" para adicionar.
                    </TableCell>
                  </TableRow>
                ) : (
                  horarios.map((horario, index) => (
                    <TableRow 
                      key={horario.id} 
                      className={cn(
                        horario.tipo === "intervalo" && "bg-muted/30",
                        !horario.ativo && "opacity-50"
                      )}
                      data-testid={`row-horario-${horario.id}`}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveHorario(horario.id, "up")}
                            disabled={index === 0}
                            data-testid={`button-move-up-${horario.id}`}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveHorario(horario.id, "down")}
                            disabled={index === horarios.length - 1}
                            data-testid={`button-move-down-${horario.id}`}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {horario.tipo === "aula" ? (
                            <BookOpen className="h-4 w-4 text-primary" />
                          ) : (
                            <Coffee className="h-4 w-4 text-muted-foreground" />
                          )}
                          {horario.nome}
                        </div>
                      </TableCell>
                      <TableCell>{horario.inicio}</TableCell>
                      <TableCell>{horario.fim}</TableCell>
                      <TableCell>
                        <Badge variant={horario.tipo === "aula" ? "default" : "secondary"}>
                          {horario.tipo === "aula" ? "Aula" : "Intervalo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={horario.ativo ? "default" : "outline"}>
                          {horario.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditHorario(horario)}
                            data-testid={`button-edit-${horario.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteHorario(horario.id)}
                            data-testid={`button-delete-${horario.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-horario">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {editingHorario && horarios.find(h => h.id === editingHorario.id) 
                ? "Editar Horário" 
                : "Novo Horário"}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes do horário
            </DialogDescription>
          </DialogHeader>

          {editingHorario && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={editingHorario.nome}
                    onChange={(e) => setEditingHorario({ ...editingHorario, nome: e.target.value })}
                    placeholder="Ex: 1ª Aula, Intervalo"
                    data-testid="input-horario-nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inicio">Hora de Início</Label>
                  <Input
                    id="inicio"
                    type="time"
                    value={editingHorario.inicio}
                    onChange={(e) => setEditingHorario({ ...editingHorario, inicio: e.target.value })}
                    data-testid="input-horario-inicio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fim">Hora de Fim</Label>
                  <Input
                    id="fim"
                    type="time"
                    value={editingHorario.fim}
                    onChange={(e) => setEditingHorario({ ...editingHorario, fim: e.target.value })}
                    data-testid="input-horario-fim"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select 
                    value={editingHorario.tipo} 
                    onValueChange={(value: "aula" | "intervalo") => setEditingHorario({ ...editingHorario, tipo: value })}
                  >
                    <SelectTrigger data-testid="select-horario-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aula">Aula</SelectItem>
                      <SelectItem value="intervalo">Intervalo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ativo">Status</Label>
                  <div className="flex items-center space-x-2 h-9">
                    <Switch
                      id="ativo"
                      checked={editingHorario.ativo}
                      onCheckedChange={(checked) => setEditingHorario({ ...editingHorario, ativo: checked })}
                      data-testid="switch-horario-ativo"
                    />
                    <Label htmlFor="ativo">{editingHorario.ativo ? "Ativo" : "Inativo"}</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveHorario}
              disabled={!editingHorario?.nome || !editingHorario?.inicio || !editingHorario?.fim}
              data-testid="button-confirm-horario"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
