import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  DIAS_SEMANA, 
  HORARIOS_AULAS,
  MATERIAS_SEM_PROFESSOR,
  type DiaSemana, 
  type SlotAula,
  type GradeHoraria,
  type HorarioAula,
  type MateriaCustomizada
} from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Plus, Edit, Trash2, Clock, User, BookOpen, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const DIAS_LABELS: Record<DiaSemana, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

interface Professor {
  uid: string;
  nome: string;
  materias?: string[];
}

interface ScheduleGridProps {
  slots: SlotAula[];
  onSlotClick?: (dia: DiaSemana, horarioId: string, slot?: SlotAula) => void;
  onSlotRemove?: (dia: DiaSemana, horarioId: string) => void;
  editable?: boolean;
  professores?: Professor[];
  materias?: string[];
  compact?: boolean;
  showLegend?: boolean;
  highlightProfessorId?: string;
  diasExibidos?: DiaSemana[];
  horariosExibidos?: string[];
  horariosCustom?: HorarioAula[];
}

function getMateriaColor(materia: string): string {
  const colors: Record<string, string> = {
    "Matemática": "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700",
    "Português": "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700",
    "História": "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700",
    "Geografia": "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700",
    "Física": "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700",
    "Química": "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700",
    "Biologia": "bg-lime-100 dark:bg-lime-900/50 text-lime-800 dark:text-lime-200 border-lime-300 dark:border-lime-700",
    "Inglês": "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700",
    "Educação Física": "bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700",
    "Artes": "bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700",
    "Filosofia": "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700",
    "Sociologia": "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200 border-violet-300 dark:border-violet-700",
    "Redação": "bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700",
    "Literatura": "bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-300 dark:border-fuchsia-700",
    "Revisão": "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700",
    "Corujão": "bg-slate-100 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700",
  };
  return colors[materia] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600";
}

function materiaNaoPrecisaProfessor(materia: string, materiasCustomizadas?: MateriaCustomizada[]): boolean {
  if (MATERIAS_SEM_PROFESSOR.includes(materia as any)) {
    return true;
  }
  if (materiasCustomizadas) {
    const custom = materiasCustomizadas.find(m => m.nome === materia);
    if (custom && !custom.requerProfessor) {
      return true;
    }
  }
  return false;
}

export function ScheduleGrid({
  slots,
  onSlotClick,
  onSlotRemove,
  editable = false,
  professores = [],
  materias = [],
  compact = false,
  showLegend = true,
  highlightProfessorId,
  diasExibidos = DIAS_SEMANA as unknown as DiaSemana[],
  horariosExibidos,
  horariosCustom,
}: ScheduleGridProps) {
  const baseHorarios = horariosCustom && horariosCustom.length > 0 ? horariosCustom : HORARIOS_AULAS;
  const horarios = horariosExibidos 
    ? baseHorarios.filter(h => horariosExibidos.includes(h.id))
    : baseHorarios;

  const isMobile = useIsMobile();

  const getSlot = (dia: DiaSemana, horarioId: string): SlotAula | undefined => {
    return slots.find(s => s.diaSemana === dia && s.horarioId === horarioId);
  };

  const materiasUsadas = Array.from(new Set(slots.map(s => s.materia)));

  if (isMobile && !editable) {
    return (
      <div className="space-y-4">
        {diasExibidos.map((dia) => {
          const daySlots = horarios
            .filter((horario) => horario.tipo !== "intervalo")
            .map((horario) => ({ horario, slot: getSlot(dia, horario.id) }))
            .filter((item) => item.slot);

          return (
            <Card key={dia} className="overflow-hidden border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  {DIAS_LABELS[dia]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {daySlots.length ? (
                  daySlots.map(({ horario, slot }) => (
                    <div
                      key={`${dia}-${horario.id}`}
                      className={cn(
                        "rounded-2xl border p-3 shadow-sm",
                        slot ? getMateriaColor(slot.materia) : "bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold leading-tight">{slot?.materia}</div>
                          <div className="mt-1 flex items-center gap-1 text-xs opacity-80">
                            <Clock className="h-3 w-3" />
                            <span>{horario.inicio} - {horario.fim}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-background/70">{horario.nome}</Badge>
                      </div>
                      {slot?.professorNome && (
                        <div className="mt-2 flex items-center gap-1 text-sm opacity-90">
                          <User className="h-3.5 w-3.5" />
                          <span>Prof. {slot.professorNome}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma aula cadastrada para este dia.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {showLegend && materiasUsadas.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4">
            <span className="w-full text-sm font-semibold text-foreground">Legenda das matérias</span>
            {materiasUsadas.map((materia) => (
              <Badge key={materia} variant="outline" className={cn("text-xs", getMateriaColor(materia))}>
                {materia}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto schedule-grid-scroll">
        <table className="w-full border-collapse min-w-[760px] md:min-w-[600px]">
          <thead>
            <tr>
              <th className={cn(
                "border border-border bg-muted/50 font-medium text-muted-foreground sticky left-0 z-20",
                compact ? "p-1 text-xs" : "p-2 text-sm"
              )}>
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Horário</span>
                </div>
              </th>
              {diasExibidos.map(dia => (
                <th 
                  key={dia} 
                  className={cn(
                    "border border-border bg-muted/50 font-medium text-muted-foreground",
                    compact ? "p-1 text-xs" : "p-2 text-sm"
                  )}
                >
                  {DIAS_LABELS[dia]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horarios.map(horario => {
              const isIntervalo = horario.tipo === "intervalo";
              
              return (
                <tr key={horario.id} className={cn(isIntervalo && "bg-muted/40")}>
                  <td className={cn(
                    "border border-border bg-muted/30 text-center font-medium sticky left-0 z-10",
                    compact ? "p-1 text-xs" : "p-2 text-sm",
                    isIntervalo && "bg-muted/50"
                  )}>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{horario.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {horario.inicio} - {horario.fim}
                      </span>
                    </div>
                  </td>
                  {isIntervalo ? (
                    <td 
                      colSpan={diasExibidos.length}
                      className={cn(
                        "border border-border text-center bg-muted/30",
                        compact ? "p-1 text-xs" : "p-2 text-sm"
                      )}
                      data-testid={`cell-intervalo-${horario.id}`}
                    >
                      <div className="flex items-center justify-center gap-2 text-muted-foreground italic">
                        <Clock className="h-4 w-4" />
                        <span>{horario.nome}</span>
                      </div>
                    </td>
                  ) : (
                    diasExibidos.map(dia => {
                      const slot = getSlot(dia, horario.id);
                      const isHighlighted = highlightProfessorId && slot?.professorId === highlightProfessorId;

                      return (
                        <td
                          key={`${dia}-${horario.id}`}
                          className={cn(
                            "border border-border transition-colors",
                            compact ? "p-1" : "p-1.5",
                            editable && !slot && "hover-elevate cursor-pointer",
                            isHighlighted && "ring-2 ring-primary ring-inset"
                          )}
                          onClick={() => {
                            if (editable && onSlotClick) {
                              onSlotClick(dia, horario.id, slot);
                            }
                          }}
                          data-testid={`cell-${dia}-${horario.id}`}
                        >
                          {slot ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "rounded border p-1.5 text-center relative group",
                                    getMateriaColor(slot.materia),
                                    compact ? "text-xs" : "text-sm"
                                  )}>
                                    <div className="font-medium truncate">{slot.materia}</div>
                                    {!compact && slot.professorNome && (
                                      <div className="text-xs opacity-80 truncate flex items-center justify-center gap-1">
                                        <User className="h-3 w-3" />
                                        Prof. {slot.professorNome.split(" ")[0]}
                                      </div>
                                    )}
                                    {editable && onSlotRemove && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSlotRemove(dia, horario.id);
                                        }}
                                        data-testid={`remove-${dia}-${horario.id}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">
                                    <p className="font-medium">{slot.materia}</p>
                                    <p className="text-muted-foreground">Prof. {slot.professorNome}</p>
                                    <p className="text-muted-foreground">{horario.inicio} - {horario.fim}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : editable ? (
                            <div className="h-12 flex items-center justify-center text-muted-foreground/40">
                              <Plus className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className={cn("h-12", compact && "h-8")} />
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showLegend && materiasUsadas.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <span className="text-sm text-muted-foreground mr-2">Legenda:</span>
          {materiasUsadas.map(materia => (
            <Badge 
              key={materia} 
              variant="outline"
              className={cn("text-xs", getMateriaColor(materia))}
            >
              {materia}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface SlotEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dia: DiaSemana;
  horarioId: string;
  existingSlot?: SlotAula;
  professores: Professor[];
  materias: string[];
  materiasCustomizadas?: MateriaCustomizada[];
  onSave: (slot: Omit<SlotAula, "diaSemana" | "horarioId">) => void;
  onRemove?: () => void;
  conflictCheck?: (professorId: string) => SlotAula | undefined;
  horariosCustom?: HorarioAula[];
}

export function SlotEditDialog({
  open,
  onOpenChange,
  dia,
  horarioId,
  existingSlot,
  professores,
  materias,
  materiasCustomizadas,
  onSave,
  onRemove,
  conflictCheck,
  horariosCustom,
}: SlotEditDialogProps) {
  const [selectedMateria, setSelectedMateria] = useState(existingSlot?.materia || "");
  const [selectedProfessorId, setSelectedProfessorId] = useState(existingSlot?.professorId || "");
  const [conflict, setConflict] = useState<SlotAula | undefined>();

  const baseHorarios = horariosCustom && horariosCustom.length > 0 ? horariosCustom : HORARIOS_AULAS;
  const horario = baseHorarios.find(h => h.id === horarioId);
  const selectedProfessor = professores.find(p => p.uid === selectedProfessorId);
  
  const semProfessor = selectedMateria ? materiaNaoPrecisaProfessor(selectedMateria, materiasCustomizadas) : false;

  const handleProfessorChange = (professorId: string) => {
    setSelectedProfessorId(professorId);
    if (conflictCheck) {
      const conflictSlot = conflictCheck(professorId);
      setConflict(conflictSlot);
    }
  };

  const handleSave = () => {
    if (!selectedMateria) return;
    
    if (semProfessor) {
      onSave({
        materia: selectedMateria,
        professorId: "",
        professorNome: "",
      });
    } else {
      if (!selectedProfessorId || !selectedProfessor) return;
      onSave({
        materia: selectedMateria,
        professorId: selectedProfessorId,
        professorNome: selectedProfessor.nome,
      });
    }
    onOpenChange(false);
  };

  const professoresDisp = selectedMateria 
    ? professores.filter(p => p.materias?.includes(selectedMateria))
    : professores;

  const canSave = selectedMateria && (semProfessor || (selectedProfessorId && !conflict));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-slot">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {existingSlot ? "Editar Aula" : "Adicionar Aula"}
          </DialogTitle>
          <DialogDescription>
            {DIAS_LABELS[dia]} - {horario?.nome} ({horario?.inicio} - {horario?.fim})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Matéria</Label>
            <Select value={selectedMateria} onValueChange={(v) => {
              setSelectedMateria(v);
              setSelectedProfessorId("");
            }}>
              <SelectTrigger data-testid="select-materia">
                <SelectValue placeholder="Selecione a matéria" />
              </SelectTrigger>
              <SelectContent>
                {materias.map(materia => (
                  <SelectItem key={materia} value={materia}>
                    {materia}
                    {materiaNaoPrecisaProfessor(materia, materiasCustomizadas) && (
                      <span className="ml-2 text-xs text-muted-foreground">(sem professor)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!semProfessor && (
            <div className="space-y-2">
              <Label>Professor</Label>
              <Select 
                value={selectedProfessorId} 
                onValueChange={handleProfessorChange}
                disabled={!selectedMateria}
              >
                <SelectTrigger data-testid="select-professor">
                  <SelectValue placeholder={selectedMateria ? "Selecione o professor" : "Selecione uma matéria primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {professoresDisp.map(professor => (
                    <SelectItem key={professor.uid} value={professor.uid}>
                      {professor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {professoresDisp.length === 0 && selectedMateria && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Nenhum professor cadastrado para esta matéria
                </p>
              )}
            </div>
          )}

          {semProfessor && selectedMateria && (
            <div className="p-3 bg-muted/50 border rounded-md">
              <p className="text-sm text-muted-foreground">
                Esta atividade não requer um professor atribuído.
              </p>
            </div>
          )}

          {conflict && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive font-medium">
                Conflito de Horário!
              </p>
              <p className="text-sm text-destructive/80">
                Este professor já tem aula de {conflict.materia} neste horário na turma correspondente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {existingSlot && onRemove && (
            <Button 
              variant="destructive" 
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
              data-testid="button-remove-slot"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            data-testid="button-save-slot"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ScheduleViewCardProps {
  grade: GradeHoraria;
  onEdit?: () => void;
  onPublish?: () => void;
  compact?: boolean;
}

export function ScheduleViewCard({ grade, onEdit, onPublish, compact }: ScheduleViewCardProps) {
  return (
    <Card data-testid={`card-grade-${grade.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {grade.turmaNome}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ano letivo: {grade.anoLetivo}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={grade.status === "publicado" ? "default" : "secondary"}>
              {grade.status === "publicado" ? "Publicado" : "Rascunho"}
            </Badge>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} data-testid="button-edit-grade">
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {onPublish && grade.status === "rascunho" && (
              <Button size="sm" onClick={onPublish} data-testid="button-publish-grade">
                Publicar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScheduleGrid 
          slots={grade.slots} 
          compact={compact}
          showLegend={!compact}
        />
      </CardContent>
    </Card>
  );
}
