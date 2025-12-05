import { useState, useMemo } from "react";
import { collection, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { 
  type EventoCalendario,
  type GradeHoraria,
  type ConfiguracaoHorarios,
  DIAS_SEMANA,
  HORARIOS_AULAS_PADRAO,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Users,
  GraduationCap,
  Coffee,
  PartyPopper,
  AlertTriangle,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth, addMonths, subMonths, parseISO, isWithinInterval, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_EVENTO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  aula: { label: "Aula", icon: BookOpen, color: "bg-blue-500" },
  reuniao: { label: "Reunião", icon: Users, color: "bg-purple-500" },
  feriado: { label: "Feriado", icon: PartyPopper, color: "bg-red-500" },
  recesso: { label: "Recesso", icon: Coffee, color: "bg-orange-500" },
  evento: { label: "Evento", icon: CalendarDays, color: "bg-green-500" },
  prova: { label: "Prova", icon: GraduationCap, color: "bg-yellow-500" },
  outro: { label: "Outro", icon: Calendar, color: "bg-gray-500" },
};

const DIAS_LABELS: Record<string, string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

interface CalendarioProgramacaoTabProps {
  turmas: any[];
}

export function CalendarioProgramacaoTab({ turmas }: CalendarioProgramacaoTabProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"semana" | "mes">("semana");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<EventoCalendario> | null>(null);
  const [selectedTurmaFilter, setSelectedTurmaFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const { data: eventos, isLoading: loadingEventos, refetch: refetchEventos } = useRealtimeQuery<EventoCalendario>({
    collectionName: "eventosCalendario",
    queryKey: ["eventosCalendario"],
  });

  const { data: grades, isLoading: loadingGrades } = useRealtimeQuery<GradeHoraria>({
    collectionName: "gradesHorarias",
    queryKey: ["gradesHorarias"],
  });

  const { data: configHorarios } = useRealtimeQuery<ConfiguracaoHorarios>({
    collectionName: "configuracaoHorarios",
    queryKey: ["configuracaoHorarios"],
  });

  const horarios = useMemo(() => {
    if (configHorarios && configHorarios.length > 0) {
      const activeConfig = configHorarios.find(c => c.ativo) || configHorarios[0];
      return activeConfig.horarios.filter(h => h.tipo === "aula" && h.ativo);
    }
    return HORARIOS_AULAS_PADRAO.filter(h => h.tipo === "aula");
  }, [configHorarios]);

  const diasAtivos = useMemo(() => {
    if (configHorarios && configHorarios.length > 0) {
      const activeConfig = configHorarios.find(c => c.ativo) || configHorarios[0];
      return activeConfig.diasAtivos;
    }
    return ["segunda", "terca", "quarta", "quinta", "sexta"];
  }, [configHorarios]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const filteredEventos = useMemo(() => {
    if (!eventos) return [];
    let filtered = eventos;
    if (selectedTurmaFilter && selectedTurmaFilter !== "all") {
      filtered = filtered.filter(e => e.turmaId === selectedTurmaFilter || !e.turmaId);
    }
    return filtered;
  }, [eventos, selectedTurmaFilter]);

  const getEventosForDate = (date: Date): EventoCalendario[] => {
    return filteredEventos.filter(evento => {
      const eventoDate = parseISO(evento.dataInicio);
      if (evento.dataFim) {
        const endDate = parseISO(evento.dataFim);
        return isWithinInterval(date, { start: eventoDate, end: endDate });
      }
      return isSameDay(eventoDate, date);
    });
  };

  const getAulasForDate = (date: Date): Array<{ turma: string; materia: string; horario: string; professor: string }> => {
    const dayOfWeek = date.getDay();
    const diasMap: Record<number, string> = {
      0: "domingo",
      1: "segunda",
      2: "terca",
      3: "quarta",
      4: "quinta",
      5: "sexta",
      6: "sabado",
    };
    const diaSemana = diasMap[dayOfWeek];
    
    if (!diasAtivos.includes(diaSemana) || !grades) return [];
    
    const aulas: Array<{ turma: string; materia: string; horario: string; professor: string }> = [];
    
    const publishedGrades = grades.filter(g => g.status === "publicado");
    
    for (const grade of publishedGrades) {
      if (selectedTurmaFilter && selectedTurmaFilter !== "all" && grade.turmaId !== selectedTurmaFilter) continue;
      
      const slotsForDay = grade.slots.filter(s => s.diaSemana === diaSemana);
      for (const slot of slotsForDay) {
        const horario = horarios.find(h => h.id === slot.horarioId);
        if (horario) {
          aulas.push({
            turma: grade.turmaNome,
            materia: slot.materia,
            horario: `${horario.inicio} - ${horario.fim}`,
            professor: slot.professorNome,
          });
        }
      }
    }
    
    return aulas.sort((a, b) => a.horario.localeCompare(b.horario));
  };

  const handlePrevious = () => {
    if (viewMode === "semana") {
      setSelectedDate(prev => addDays(prev, -7));
    } else {
      setCurrentMonth(prev => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "semana") {
      setSelectedDate(prev => addDays(prev, 7));
    } else {
      setCurrentMonth(prev => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const handleAddEvent = (date?: Date) => {
    setEditingEvent({
      titulo: "",
      tipo: "evento",
      dataInicio: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      diaInteiro: true,
      status: "agendado",
    });
    setEventDialogOpen(true);
  };

  const handleEditEvent = (evento: EventoCalendario) => {
    setEditingEvent({ ...evento });
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!userData || !editingEvent) return;

    setSaving(true);
    try {
      const eventData = {
        ...editingEvent,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      if (editingEvent.id) {
        await updateDoc(doc(db, "eventosCalendario", editingEvent.id), eventData);
        toast({
          title: "Evento atualizado!",
          description: "O evento foi atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, "eventosCalendario"), {
          ...eventData,
          criadoPor: userData.uid,
          criadoPorNome: userData.nome,
          dataCriacao: getNowBrasiliaISO(),
        });
        toast({
          title: "Evento criado!",
          description: "O evento foi adicionado ao calendário.",
        });
      }

      setEventDialogOpen(false);
      setEditingEvent(null);
      refetchEventos();
    } catch (error) {
      console.error("Erro ao salvar evento:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o evento.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Deseja excluir este evento?")) return;

    try {
      await deleteDoc(doc(db, "eventosCalendario", eventId));
      toast({
        title: "Evento excluído!",
        description: "O evento foi removido do calendário.",
      });
      refetchEventos();
    } catch (error) {
      console.error("Erro ao excluir evento:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o evento.",
        variant: "destructive",
      });
    }
  };

  const renderDayContent = (date: Date, compact: boolean = false) => {
    const eventos = getEventosForDate(date);
    const aulas = getAulasForDate(date);
    const isToday = isSameDay(date, new Date());
    const isSelected = isSameDay(date, selectedDate);

    return (
      <div 
        className={cn(
          "min-h-24 p-1 border-r border-b transition-colors cursor-pointer",
          isToday && "bg-primary/5",
          isSelected && "ring-2 ring-primary ring-inset",
          !isSameMonth(date, currentMonth) && viewMode === "mes" && "bg-muted/30 text-muted-foreground"
        )}
        onClick={() => setSelectedDate(date)}
        data-testid={`day-${format(date, "yyyy-MM-dd")}`}
      >
        <div className={cn(
          "text-sm font-medium mb-1",
          isToday && "text-primary"
        )}>
          {format(date, "d")}
          {!compact && (
            <span className="text-xs text-muted-foreground ml-1">
              {format(date, "EEE", { locale: ptBR })}
            </span>
          )}
        </div>
        
        <div className="space-y-0.5">
          {eventos.slice(0, compact ? 2 : 3).map(evento => {
            const config = TIPO_EVENTO_CONFIG[evento.tipo];
            return (
              <div
                key={evento.id}
                className={cn(
                  "text-xs p-0.5 rounded truncate text-white",
                  config.color
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditEvent(evento);
                }}
                data-testid={`event-${evento.id}`}
              >
                {evento.titulo}
              </div>
            );
          })}
          
          {aulas.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {aulas.length} aula{aulas.length > 1 ? "s" : ""}
            </div>
          )}
          
          {eventos.length > (compact ? 2 : 3) && (
            <div className="text-xs text-muted-foreground">
              +{eventos.length - (compact ? 2 : 3)} mais
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loadingEventos || loadingGrades) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Programação
          </h3>
          <p className="text-sm text-muted-foreground">
            Visualize e gerencie eventos e aulas programadas
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedTurmaFilter} onValueChange={setSelectedTurmaFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-turma-calendar">
              <SelectValue placeholder="Todas as turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.filter(t => t.ativa).map(turma => (
                <SelectItem key={turma.id} value={turma.id}>
                  {turma.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handleAddEvent()} data-testid="button-add-event">
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevious} data-testid="button-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleToday} data-testid="button-today">
                Hoje
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext} data-testid="button-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="font-medium ml-2">
                {viewMode === "semana" 
                  ? `${format(weekDays[0], "d MMM", { locale: ptBR })} - ${format(weekDays[6], "d MMM yyyy", { locale: ptBR })}`
                  : format(currentMonth, "MMMM yyyy", { locale: ptBR })
                }
              </span>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "semana" | "mes")}>
              <TabsList>
                <TabsTrigger value="semana" data-testid="tab-semana">Semana</TabsTrigger>
                <TabsTrigger value="mes" data-testid="tab-mes">Mês</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "semana" ? (
            <div className="grid grid-cols-7 border-t border-l">
              {weekDays.map(day => (
                <div key={day.toISOString()}>
                  {renderDayContent(day)}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 border-t border-l mb-1">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground border-r border-b">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-t border-l">
                {(() => {
                  const firstDay = startOfMonth(currentMonth);
                  const startDay = firstDay.getDay();
                  const daysInMonth = monthDays.length;
                  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
                  
                  return Array.from({ length: totalCells }, (_, i) => {
                    const dayOffset = i - startDay;
                    const date = addDays(firstDay, dayOffset);
                    return (
                      <div key={i}>
                        {renderDayContent(date, true)}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Detalhes do Dia
            </CardTitle>
            <CardDescription>
              {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {getEventosForDate(selectedDate).length === 0 && getAulasForDate(selectedDate).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum evento ou aula neste dia
                  </p>
                ) : (
                  <>
                    {getEventosForDate(selectedDate).map(evento => {
                      const config = TIPO_EVENTO_CONFIG[evento.tipo];
                      const Icon = config.icon;
                      return (
                        <div
                          key={evento.id}
                          className="flex items-start gap-2 p-2 rounded-md border"
                          data-testid={`detail-event-${evento.id}`}
                        >
                          <div className={cn("p-1.5 rounded", config.color)}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{evento.titulo}</div>
                            {evento.descricao && (
                              <p className="text-xs text-muted-foreground truncate">{evento.descricao}</p>
                            )}
                            {evento.horarioInicio && (
                              <p className="text-xs text-muted-foreground">
                                {evento.horarioInicio} - {evento.horarioFim}
                              </p>
                            )}
                            <Badge variant="outline" className="text-xs mt-1">
                              {config.label}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditEvent(evento)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteEvent(evento.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {getAulasForDate(selectedDate).map((aula, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                        data-testid={`detail-aula-${idx}`}
                      >
                        <div className="p-1.5 rounded bg-blue-500">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{aula.materia}</div>
                          <p className="text-xs text-muted-foreground">{aula.turma}</p>
                          <p className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {aula.horario}
                          </p>
                          <p className="text-xs text-muted-foreground">Prof. {aula.professor}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredEventos
                  .filter(e => parseISO(e.dataInicio) >= new Date())
                  .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())
                  .slice(0, 5)
                  .map(evento => {
                    const config = TIPO_EVENTO_CONFIG[evento.tipo];
                    const Icon = config.icon;
                    return (
                      <div
                        key={evento.id}
                        className="flex items-center gap-2 p-2 rounded-md border hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedDate(parseISO(evento.dataInicio));
                          handleEditEvent(evento);
                        }}
                      >
                        <div className={cn("p-1.5 rounded", config.color)}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{evento.titulo}</div>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(evento.dataInicio), "d MMM", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                    );
                  })}
                {filteredEventos.filter(e => parseISO(e.dataInicio) >= new Date()).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum evento futuro
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-event">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingEvent?.id ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
            <DialogDescription>
              Preencha os detalhes do evento
            </DialogDescription>
          </DialogHeader>

          {editingEvent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={editingEvent.titulo || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, titulo: e.target.value })}
                  placeholder="Nome do evento"
                  data-testid="input-event-titulo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={editingEvent.descricao || ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, descricao: e.target.value })}
                  placeholder="Descrição opcional"
                  rows={2}
                  data-testid="input-event-descricao"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={editingEvent.tipo}
                    onValueChange={(value) => setEditingEvent({ ...editingEvent, tipo: value as any })}
                  >
                    <SelectTrigger data-testid="select-event-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_EVENTO_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1 rounded", config.color)}>
                              <config.icon className="h-3 w-3 text-white" />
                            </div>
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="turma">Turma (opcional)</Label>
                  <Select
                    value={editingEvent.turmaId || "none"}
                    onValueChange={(value) => {
                      const turma = turmas.find(t => t.id === value);
                      setEditingEvent({ 
                        ...editingEvent, 
                        turmaId: value === "none" ? undefined : value,
                        turmaNome: turma?.nome,
                      });
                    }}
                  >
                    <SelectTrigger data-testid="select-event-turma">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {turmas.filter(t => t.ativa).map(turma => (
                        <SelectItem key={turma.id} value={turma.id}>
                          {turma.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data de Início</Label>
                  <Input
                    id="dataInicio"
                    type="date"
                    value={editingEvent.dataInicio || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dataInicio: e.target.value })}
                    data-testid="input-event-data-inicio"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data de Fim (opcional)</Label>
                  <Input
                    id="dataFim"
                    type="date"
                    value={editingEvent.dataFim || ""}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dataFim: e.target.value })}
                    data-testid="input-event-data-fim"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="diaInteiro"
                  checked={editingEvent.diaInteiro}
                  onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, diaInteiro: checked })}
                  data-testid="switch-event-dia-inteiro"
                />
                <Label htmlFor="diaInteiro">Dia inteiro</Label>
              </div>

              {!editingEvent.diaInteiro && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="horarioInicio">Hora de Início</Label>
                    <Input
                      id="horarioInicio"
                      type="time"
                      value={editingEvent.horarioInicio || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, horarioInicio: e.target.value })}
                      data-testid="input-event-horario-inicio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horarioFim">Hora de Fim</Label>
                    <Input
                      id="horarioFim"
                      type="time"
                      value={editingEvent.horarioFim || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, horarioFim: e.target.value })}
                      data-testid="input-event-horario-fim"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEvent}
              disabled={!editingEvent?.titulo || !editingEvent?.dataInicio || saving}
              data-testid="button-save-event"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
