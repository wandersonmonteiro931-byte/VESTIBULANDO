import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, deleteDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Calendar, Edit, Trash2, CalendarClock, 
  AlertCircle, CheckCircle, Clock
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { BimestreConfig, Turma, User, NotaBimestre } from "@shared/schema";
import { MATERIAS_BOLETIM } from "@shared/schema";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { formatNota } from "@/lib/utils";

const ANOS_DISPONIVEIS = [
  (new Date().getFullYear() - 1).toString(),
  new Date().getFullYear().toString(),
  (new Date().getFullYear() + 1).toString(),
];

const BIMESTRES_NOMES = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];

interface BimestresTabProps {
  userType?: "diretor" | "professor";
}

export function BimestresTab({ userType = "diretor" }: BimestresTabProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear().toString());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewNotasDialogOpen, setViewNotasDialogOpen] = useState(false);
  const [selectedBimestre, setSelectedBimestre] = useState<BimestreConfig | null>(null);
  const [selectedTurmaForNotas, setSelectedTurmaForNotas] = useState<string>("");
  
  const [formData, setFormData] = useState({
    numero: 1,
    dataInicio: "",
    dataFim: "",
    prazoLancamentoNotas: "",
    mediaEsperada: 7,
    ativo: true,
  });

  const { data: bimestresConfigs, isLoading: loadingBimestres } = useRealtimeQuery<BimestreConfig>({
    collectionName: "bimestresConfig",
    queryKey: ["/api/bimestres-config", selectedAno],
    constraints: [where("ano", "==", selectedAno)],
    transform: (docs) => docs as BimestreConfig[],
  });

  const { data: turmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["/api/turmas"],
    transform: (docs) => docs as Turma[],
  });

  const { data: alunos } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["/api/usuarios/alunos"],
    constraints: [where("tipo", "==", "aluno"), where("status", "==", "aprovado")],
    transform: (docs) => docs as User[],
  });

  const { data: notasBimestre } = useRealtimeQuery<NotaBimestre>({
    collectionName: "notasBimestre",
    queryKey: ["/api/notas-bimestre", selectedAno],
    constraints: [where("ano", "==", selectedAno)],
    transform: (docs) => docs as NotaBimestre[],
    enabled: !!selectedAno,
  });

  const sortedBimestres = useMemo(() => {
    if (!bimestresConfigs) return [];
    return [...bimestresConfigs].sort((a, b) => a.numero - b.numero);
  }, [bimestresConfigs]);

  const getStatusBimestre = (bimestre: BimestreConfig) => {
    const now = new Date();
    const inicio = parseISO(bimestre.dataInicio);
    const fim = parseISO(bimestre.dataFim);
    const prazo = parseISO(bimestre.prazoLancamentoNotas);

    if (!bimestre.ativo) return { label: "Inativo", variant: "secondary" as const };
    if (isBefore(now, inicio)) return { label: "Aguardando", variant: "outline" as const };
    if (isAfter(now, prazo)) return { label: "Prazo Encerrado", variant: "destructive" as const };
    if (isAfter(now, fim)) return { label: "Lançamento", variant: "default" as const };
    return { label: "Em Andamento", variant: "default" as const };
  };

  const openCreateDialog = (numero: number) => {
    setFormData({
      numero,
      dataInicio: "",
      dataFim: "",
      prazoLancamentoNotas: "",
      mediaEsperada: 7,
      ativo: true,
    });
    setCreateDialogOpen(true);
  };

  const openEditDialog = (bimestre: BimestreConfig) => {
    setSelectedBimestre(bimestre);
    setFormData({
      numero: bimestre.numero,
      dataInicio: bimestre.dataInicio.split("T")[0],
      dataFim: bimestre.dataFim.split("T")[0],
      prazoLancamentoNotas: bimestre.prazoLancamentoNotas.split("T")[0],
      mediaEsperada: bimestre.mediaEsperada,
      ativo: bimestre.ativo,
    });
    setEditDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userData) throw new Error("Usuário não autenticado");
      if (!formData.dataInicio || !formData.dataFim || !formData.prazoLancamentoNotas) {
        throw new Error("Preencha todas as datas");
      }

      const existingBimestre = sortedBimestres.find(b => b.numero === formData.numero);
      if (existingBimestre) {
        throw new Error(`O ${BIMESTRES_NOMES[formData.numero - 1]} já está configurado para ${selectedAno}`);
      }

      const bimestreData = {
        ano: selectedAno,
        numero: formData.numero,
        nome: BIMESTRES_NOMES[formData.numero - 1],
        dataInicio: formData.dataInicio + "T00:00:00",
        dataFim: formData.dataFim + "T23:59:59",
        prazoLancamentoNotas: formData.prazoLancamentoNotas + "T23:59:59",
        mediaEsperada: formData.mediaEsperada,
        ativo: formData.ativo,
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: getNowBrasiliaISO(),
      };

      await addDoc(collection(db, "bimestresConfig"), bimestreData);
      return bimestreData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bimestres-config"] });
      toast({
        title: "Bimestre configurado!",
        description: `${BIMESTRES_NOMES[formData.numero - 1]} foi criado com sucesso.`,
      });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar bimestre",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!userData || !selectedBimestre) throw new Error("Erro ao atualizar");
      if (!formData.dataInicio || !formData.dataFim || !formData.prazoLancamentoNotas) {
        throw new Error("Preencha todas as datas");
      }

      const bimestreData = {
        dataInicio: formData.dataInicio + "T00:00:00",
        dataFim: formData.dataFim + "T23:59:59",
        prazoLancamentoNotas: formData.prazoLancamentoNotas + "T23:59:59",
        mediaEsperada: formData.mediaEsperada,
        ativo: formData.ativo,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      await updateDoc(doc(db, "bimestresConfig", selectedBimestre.id), bimestreData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bimestres-config"] });
      toast({
        title: "Bimestre atualizado!",
        description: "As alterações foram salvas.",
      });
      setEditDialogOpen(false);
      setSelectedBimestre(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBimestre) throw new Error("Bimestre não selecionado");
      await deleteDoc(doc(db, "bimestresConfig", selectedBimestre.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bimestres-config"] });
      toast({
        title: "Bimestre excluído",
        description: "O bimestre foi removido do sistema.",
      });
      setDeleteDialogOpen(false);
      setSelectedBimestre(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getBimestreNumeros = () => {
    const configurados = sortedBimestres.map(b => b.numero);
    return [1, 2, 3, 4].filter(n => !configurados.includes(n));
  };

  const getNotasParaBimestre = (bimestreId: string, turmaId: string) => {
    if (!notasBimestre) return [];
    return notasBimestre.filter(n => 
      n.bimestreConfigId === bimestreId && n.turmaId === turmaId
    );
  };

  const getAlunosDaTurma = (turmaId: string) => {
    if (!alunos) return [];
    return alunos.filter(a => a.turma === turmaId);
  };

  const stats = useMemo(() => ({
    total: sortedBimestres.length,
    ativos: sortedBimestres.filter(b => b.ativo).length,
    emAndamento: sortedBimestres.filter(b => {
      const status = getStatusBimestre(b);
      return status.label === "Em Andamento" || status.label === "Lançamento";
    }).length,
  }), [sortedBimestres]);

  if (loadingBimestres) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="h-6 w-6" />
            Bimestres
          </h2>
          <p className="text-muted-foreground">Configure os períodos e prazos de cada bimestre</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Label htmlFor="ano-filter">Ano:</Label>
          <Select value={selectedAno} onValueChange={setSelectedAno}>
            <SelectTrigger className="w-32" data-testid="select-ano-bimestre">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS_DISPONIVEIS.map(ano => (
                <SelectItem key={ano} value={ano}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bimestres Configurados</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}/4</div>
            <p className="text-xs text-muted-foreground">no ano de {selectedAno}</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
            <p className="text-xs text-muted-foreground">bimestres ativos</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.emAndamento}</div>
            <p className="text-xs text-muted-foreground">período atual</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(numero => {
          const bimestre = sortedBimestres.find(b => b.numero === numero);
          
          if (!bimestre) {
            return (
              <Card key={numero} className="border-dashed hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">{BIMESTRES_NOMES[numero - 1]}</CardTitle>
                  <CardDescription>Não configurado</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Este bimestre ainda não foi configurado
                  </p>
                  {userType === "diretor" && (
                    <Button
                      onClick={() => openCreateDialog(numero)}
                      data-testid={`button-create-bimestre-${numero}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          }

          const status = getStatusBimestre(bimestre);

          return (
            <Card key={numero} className="hover-elevate">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{bimestre.nome}</CardTitle>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <CardDescription>Ano {selectedAno}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Início:</span>
                    <span className="font-medium">
                      {format(parseISO(bimestre.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fim:</span>
                    <span className="font-medium">
                      {format(parseISO(bimestre.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prazo Notas:</span>
                    <span className="font-medium text-orange-600">
                      {format(parseISO(bimestre.prazoLancamentoNotas), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Média Esperada:</span>
                    <span className="font-medium">{bimestre.mediaEsperada}</span>
                  </div>
                </div>

                {userType === "diretor" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(bimestre)}
                      data-testid={`button-edit-bimestre-${numero}`}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBimestre(bimestre);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-bimestre-${numero}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {userType === "diretor" && sortedBimestres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Visualizar Notas por Turma</CardTitle>
            <CardDescription>Selecione uma turma para ver o resumo das notas lançadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end flex-wrap">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label>Turma</Label>
                <Select value={selectedTurmaForNotas} onValueChange={setSelectedTurmaForNotas}>
                  <SelectTrigger data-testid="select-turma-notas">
                    <SelectValue placeholder="Selecione uma turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas?.filter(t => t.ativa).map(turma => (
                      <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setViewNotasDialogOpen(true)}
                disabled={!selectedTurmaForNotas}
                data-testid="button-view-notas"
              >
                Ver Notas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-bimestre">
          <DialogHeader>
            <DialogTitle>Configurar Bimestre</DialogTitle>
            <DialogDescription>
              Configure as datas e prazos do {BIMESTRES_NOMES[formData.numero - 1]} de {selectedAno}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bimestre</Label>
              <Select 
                value={formData.numero.toString()} 
                onValueChange={(v) => setFormData({ ...formData, numero: parseInt(v) })}
              >
                <SelectTrigger data-testid="select-numero-bimestre">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getBimestreNumeros().map(n => (
                    <SelectItem key={n} value={n.toString()}>{BIMESTRES_NOMES[n - 1]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                  data-testid="input-data-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={formData.dataFim}
                  onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                  data-testid="input-data-fim"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prazo para Lançamento de Notas</Label>
              <Input
                type="date"
                value={formData.prazoLancamentoNotas}
                onChange={(e) => setFormData({ ...formData, prazoLancamentoNotas: e.target.value })}
                data-testid="input-prazo-notas"
              />
              <p className="text-xs text-muted-foreground">
                Data limite para os professores lançarem as notas
              </p>
            </div>

            <div className="space-y-2">
              <Label>Média Esperada</Label>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={formData.mediaEsperada}
                onChange={(e) => setFormData({ ...formData, mediaEsperada: parseFloat(e.target.value) || 7 })}
                data-testid="input-media-esperada"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="bimestre-ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="bimestre-ativo">Bimestre ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending ? "Salvando..." : "Criar Bimestre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-bimestre">
          <DialogHeader>
            <DialogTitle>Editar Bimestre</DialogTitle>
            <DialogDescription>
              Altere as configurações do {selectedBimestre?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                  data-testid="input-edit-data-inicio"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={formData.dataFim}
                  onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                  data-testid="input-edit-data-fim"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prazo para Lançamento de Notas</Label>
              <Input
                type="date"
                value={formData.prazoLancamentoNotas}
                onChange={(e) => setFormData({ ...formData, prazoLancamentoNotas: e.target.value })}
                data-testid="input-edit-prazo-notas"
              />
            </div>

            <div className="space-y-2">
              <Label>Média Esperada</Label>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={formData.mediaEsperada}
                onChange={(e) => setFormData({ ...formData, mediaEsperada: parseFloat(e.target.value) || 7 })}
                data-testid="input-edit-media-esperada"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="bimestre-ativo-edit"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="bimestre-ativo-edit">Bimestre ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedBimestre(null);
              }}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-bimestre">
          <DialogHeader>
            <DialogTitle>Excluir Bimestre</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o {selectedBimestre?.nome}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedBimestre(null);
              }}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewNotasDialogOpen} onOpenChange={setViewNotasDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-view-notas">
          <DialogHeader>
            <DialogTitle>Notas da Turma</DialogTitle>
            <DialogDescription>
              {turmas?.find(t => t.id === selectedTurmaForNotas)?.nome} - Ano {selectedAno}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {sortedBimestres.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum bimestre configurado para este ano</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedBimestres.map(bimestre => {
                  const alunosTurma = getAlunosDaTurma(selectedTurmaForNotas);
                  const notasDoBimestre = getNotasParaBimestre(bimestre.id, selectedTurmaForNotas);
                  
                  return (
                    <div key={bimestre.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        {bimestre.nome}
                        <Badge variant={getStatusBimestre(bimestre).variant}>
                          {getStatusBimestre(bimestre).label}
                        </Badge>
                      </h3>
                      
                      {alunosTurma.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Aluno</TableHead>
                              {MATERIAS_BOLETIM.slice(0, 8).map(materia => (
                                <TableHead key={materia} className="text-center text-xs">{materia.slice(0, 3)}</TableHead>
                              ))}
                              <TableHead className="text-center">Média</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {alunosTurma.map(aluno => {
                              const notasAluno = notasDoBimestre.filter(n => n.alunoId === aluno.uid);
                              const notasValidas = notasAluno.filter(n => n.nota !== null);
                              const media = notasValidas.length > 0 
                                ? notasValidas.reduce((acc, n) => acc + (n.nota || 0), 0) / notasValidas.length 
                                : null;
                              
                              return (
                                <TableRow key={aluno.uid}>
                                  <TableCell className="font-medium text-sm">{aluno.nome}</TableCell>
                                  {MATERIAS_BOLETIM.slice(0, 8).map(materia => {
                                    const nota = notasAluno.find(n => n.materia === materia);
                                    return (
                                      <TableCell key={materia} className="text-center text-sm">
                                        {formatNota(nota?.nota)}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-center font-semibold">
                                    {formatNota(media)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewNotasDialogOpen(false)}
              data-testid="button-close"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
