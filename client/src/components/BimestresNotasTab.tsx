import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { doc, where, setDoc, getDoc, addDoc, collection, updateDoc } from "firebase/firestore";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, Calendar, Edit, AlertCircle, CheckCircle, Clock,
  CalendarClock, Users, BookOpen, AlertTriangle, Lock, Send,
  KeyRound, MessageSquare
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { BimestreConfig, Turma, User, NotaBimestre, SolicitacaoEdicaoNota } from "@shared/schema";
import { MATERIAS_BOLETIM } from "@shared/schema";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";

const ANOS_DISPONIVEIS = [
  (new Date().getFullYear() - 1).toString(),
  new Date().getFullYear().toString(),
  (new Date().getFullYear() + 1).toString(),
];

interface NotaLocal {
  alunoId: string;
  alunoNome: string;
  alunoMatricula?: string;
  nota: number | null;
  observacao: string;
  existingId?: string;
  status: "rascunho" | "entregue";
  edicaoAutorizada?: boolean;
}

export function BimestresNotasTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear().toString());
  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [selectedBimestre, setSelectedBimestre] = useState<string>("");
  const [selectedMateria, setSelectedMateria] = useState<string>("");
  const [notasLocais, setNotasLocais] = useState<NotaLocal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSubmitDialogOpen, setConfirmSubmitDialogOpen] = useState(false);
  
  const [requestAuthDialogOpen, setRequestAuthDialogOpen] = useState(false);
  const [selectedNotaForAuth, setSelectedNotaForAuth] = useState<NotaLocal | null>(null);
  const [motivoSolicitacao, setMotivoSolicitacao] = useState("");

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

  const { data: notasBimestre, refetch: refetchNotas, isLoading: loadingNotas } = useRealtimeQuery<NotaBimestre>({
    collectionName: "notasBimestre",
    queryKey: ["/api/notas-bimestre", selectedAno, selectedTurma, selectedBimestre, selectedMateria],
    constraints: selectedBimestre && selectedTurma && selectedMateria ? [
      where("ano", "==", selectedAno),
      where("bimestreConfigId", "==", selectedBimestre),
      where("turmaId", "==", selectedTurma),
      where("materia", "==", selectedMateria),
    ] : [],
    transform: (docs) => docs as NotaBimestre[],
    enabled: !!(selectedBimestre && selectedTurma && selectedMateria),
  });

  const { data: solicitacoesEdicao } = useRealtimeQuery<SolicitacaoEdicaoNota>({
    collectionName: "solicitacoesEdicaoNota",
    queryKey: ["/api/solicitacoes-edicao-nota", selectedAno, selectedTurma, selectedMateria, userData?.uid],
    constraints: selectedTurma && selectedMateria && userData ? [
      where("ano", "==", selectedAno),
      where("turmaId", "==", selectedTurma),
      where("materia", "==", selectedMateria),
      where("professorId", "==", userData.uid),
    ] : [],
    transform: (docs) => docs as SolicitacaoEdicaoNota[],
    enabled: !!(selectedTurma && selectedMateria && userData),
  });

  const notasDataLoaded = useMemo(() => {
    if (!selectedBimestre || !selectedTurma || !selectedMateria) return false;
    return !loadingNotas && notasBimestre !== undefined;
  }, [loadingNotas, notasBimestre, selectedBimestre, selectedTurma, selectedMateria]);

  const professorTurmas = useMemo(() => {
    if (!turmas || !userData) return [];
    // Diretores e professores podem ver todas as turmas ativas
    if (userData.tipo === "diretor" || userData.tipo === "professor") {
      return turmas.filter(t => t.ativa);
    }
    return [];
  }, [turmas, userData]);

  const sortedBimestres = useMemo(() => {
    if (!bimestresConfigs) return [];
    return [...bimestresConfigs].filter(b => b.ativo).sort((a, b) => a.numero - b.numero);
  }, [bimestresConfigs]);

  const alunosTurma = useMemo(() => {
    if (!alunos || !selectedTurma) return [];
    return alunos.filter(a => a.turma === selectedTurma);
  }, [alunos, selectedTurma]);

  const selectedBimestreData = useMemo(() => {
    return sortedBimestres.find(b => b.id === selectedBimestre);
  }, [sortedBimestres, selectedBimestre]);

  const isPrazoExpirado = useMemo(() => {
    if (!selectedBimestreData) return false;
    const prazo = parseISO(selectedBimestreData.prazoLancamentoNotas);
    return isAfter(new Date(), prazo);
  }, [selectedBimestreData]);

  const canEdit = useMemo(() => {
    if (userData?.tipo === "diretor") return true;
    return !isPrazoExpirado;
  }, [userData, isPrazoExpirado]);

  useEffect(() => {
    if (alunosTurma.length > 0 && selectedMateria && selectedBimestre) {
      const novasNotas: NotaLocal[] = alunosTurma.map(aluno => {
        const notaExistente = notasBimestre?.find(n => n.alunoId === aluno.uid);
        return {
          alunoId: aluno.uid,
          alunoNome: aluno.nome,
          alunoMatricula: aluno.matricula,
          nota: notaExistente?.nota ?? null,
          observacao: notaExistente?.observacao || "",
          existingId: notaExistente?.id,
          status: notaExistente?.status || "rascunho",
          edicaoAutorizada: notaExistente?.edicaoAutorizada || false,
        };
      });
      setNotasLocais(novasNotas);
    } else {
      setNotasLocais([]);
    }
  }, [alunosTurma, notasBimestre, selectedMateria, selectedBimestre]);

  const getSolicitacaoParaAluno = (alunoId: string) => {
    if (!solicitacoesEdicao || !selectedBimestreData || !selectedMateria) return null;
    const solicitacoesDoAluno = solicitacoesEdicao.filter(s => 
      s.alunoId === alunoId && 
      s.bimestreNumero === selectedBimestreData.numero &&
      s.materia === selectedMateria
    );
    if (solicitacoesDoAluno.length === 0) return null;
    return solicitacoesDoAluno.sort((a, b) => 
      new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime()
    )[0];
  };

  const openRequestAuthDialog = (nota: NotaLocal) => {
    setSelectedNotaForAuth(nota);
    setMotivoSolicitacao("");
    setRequestAuthDialogOpen(true);
  };

  const requestAuthMutation = useMutation({
    mutationFn: async () => {
      if (!userData || !selectedNotaForAuth || !selectedBimestreData || !selectedTurma || !selectedMateria) {
        throw new Error("Dados incompletos");
      }
      if (!motivoSolicitacao.trim()) {
        throw new Error("Informe o motivo da solicitação");
      }

      const turma = turmas?.find(t => t.id === selectedTurma);
      if (!turma) throw new Error("Turma não encontrada");

      const notaId = generateNotaId(selectedNotaForAuth.alunoId, selectedBimestre, selectedTurma, selectedMateria);

      const solicitacaoData = {
        notaBimestreId: notaId,
        alunoId: selectedNotaForAuth.alunoId,
        alunoNome: selectedNotaForAuth.alunoNome,
        alunoMatricula: selectedNotaForAuth.alunoMatricula || "",
        turmaId: selectedTurma,
        turmaNome: turma.nome,
        materia: selectedMateria,
        bimestreNumero: selectedBimestreData.numero,
        bimestreNome: selectedBimestreData.nome,
        ano: selectedAno,
        notaAtual: selectedNotaForAuth.nota,
        professorId: userData.uid,
        professorNome: userData.nome,
        motivo: motivoSolicitacao.trim(),
        dataSolicitacao: getNowBrasiliaISO(),
        status: "pendente" as const,
      };

      await addDoc(collection(db, "solicitacoesEdicaoNota"), solicitacaoData);
      return solicitacaoData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitacoes-edicao-nota"] });
      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação foi enviada para o diretor.",
      });
      setRequestAuthDialogOpen(false);
      setSelectedNotaForAuth(null);
      setMotivoSolicitacao("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNotaChange = (alunoId: string, nota: string) => {
    const parsedNota = nota === "" ? null : parseFloat(nota);
    if (parsedNota !== null && (isNaN(parsedNota) || parsedNota < 0 || parsedNota > 10)) {
      return;
    }
    setNotasLocais(prev => prev.map(n => 
      n.alunoId === alunoId 
        ? { ...n, nota: parsedNota }
        : n
    ));
  };

  const handleObservacaoChange = (alunoId: string, observacao: string) => {
    setNotasLocais(prev => prev.map(n => 
      n.alunoId === alunoId 
        ? { ...n, observacao }
        : n
    ));
  };

  const generateNotaId = (alunoId: string, bimestreId: string, turmaId: string, materia: string) => {
    return `${alunoId}_${bimestreId}_${turmaId}_${materia}`.replace(/\s+/g, '_');
  };

  const isDataReady = useMemo(() => {
    return notasLocais.length > 0 && 
           selectedBimestre && 
           selectedTurma && 
           selectedMateria &&
           alunosTurma.length > 0 &&
           notasDataLoaded;
  }, [notasLocais, selectedBimestre, selectedTurma, selectedMateria, alunosTurma, notasDataLoaded]);

  const saveMutation = useMutation({
    mutationFn: async (submitFinal: boolean = false) => {
      if (!userData || !selectedBimestre || !selectedTurma || !selectedMateria) {
        throw new Error("Selecione todos os campos");
      }

      if (!isDataReady || notasLocais.length === 0) {
        throw new Error("Dados não carregados completamente. Aguarde e tente novamente.");
      }

      const turma = turmas?.find(t => t.id === selectedTurma);
      const bimestre = sortedBimestres.find(b => b.id === selectedBimestre);
      
      if (!turma || !bimestre) throw new Error("Turma ou bimestre não encontrado");

      if (!bimestre.ativo) {
        throw new Error("Este bimestre está inativo e não permite lançamento de notas");
      }

      const prazo = parseISO(bimestre.prazoLancamentoNotas);
      const isPrazoExpiradoNow = isAfter(new Date(), prazo);
      
      const hasAuthorizedEdits = notasLocais.some(n => n.edicaoAutorizada);
      if (isPrazoExpiradoNow && userData.tipo !== "diretor" && !hasAuthorizedEdits) {
        throw new Error("O prazo para lançamento de notas expirou");
      }

      for (const notaLocal of notasLocais) {
        if (notaLocal.nota !== null && (isNaN(notaLocal.nota) || notaLocal.nota < 0 || notaLocal.nota > 10)) {
          throw new Error(`Nota inválida para ${notaLocal.alunoNome}. Use valores entre 0 e 10.`);
        }
      }

      setIsSaving(true);
      const isDiretor = userData.tipo === "diretor";

      const notasToUpdate = notasLocais.filter(notaLocal => {
        const isEntregue = notaLocal.status === "entregue";
        const isAutorizado = notaLocal.edicaoAutorizada;
        
        if (isDiretor) return true;
        if (isAutorizado) return true;
        if (isPrazoExpiradoNow) return false;
        if (isEntregue) return false;
        return true;
      });

      if (notasToUpdate.length === 0) {
        throw new Error("Nenhuma nota disponível para salvar");
      }

      for (const notaLocal of notasToUpdate) {
        const notaId = generateNotaId(notaLocal.alunoId, selectedBimestre, selectedTurma, selectedMateria);
        const notaRef = doc(db, "notasBimestre", notaId);
        
        const existingDoc = await getDoc(notaRef);
        const isUpdate = existingDoc.exists();
        const existingData = existingDoc.data();

        const isAutorizado = notaLocal.edicaoAutorizada || existingData?.edicaoAutorizada;
        
        let newStatus = notaLocal.status;
        if (submitFinal) {
          newStatus = "entregue";
        } else if (isAutorizado) {
          newStatus = "rascunho";
        }
        
        const notaData: any = {
          id: notaId,
          bimestreConfigId: selectedBimestre,
          ano: selectedAno,
          bimestreNumero: bimestre.numero,
          turmaId: selectedTurma,
          turmaNome: turma.nome,
          materia: selectedMateria,
          alunoId: notaLocal.alunoId,
          alunoNome: notaLocal.alunoNome,
          alunoMatricula: notaLocal.alunoMatricula || "",
          professorId: userData.uid,
          professorNome: userData.nome,
          nota: notaLocal.nota,
          mediaEsperada: bimestre.mediaEsperada,
          observacao: notaLocal.observacao || "",
          status: newStatus,
          dataLancamento: getNowBrasiliaISO(),
          ...(submitFinal ? { dataEntrega: getNowBrasiliaISO() } : {}),
          ...(isUpdate ? { dataAtualizacao: getNowBrasiliaISO() } : { dataCriacao: getNowBrasiliaISO() }),
        };

        if (isAutorizado) {
          if (existingData?.edicaoAutorizadaPor) {
            notaData.edicaoAutorizadaPor = existingData.edicaoAutorizadaPor;
            notaData.edicaoAutorizadaPorNome = existingData.edicaoAutorizadaPorNome;
            notaData.dataAutorizacaoEdicao = existingData.dataAutorizacaoEdicao;
            notaData.motivoSolicitacaoEdicao = existingData.motivoSolicitacaoEdicao;
          }
          notaData.edicaoAutorizada = submitFinal ? false : true;
        }

        await setDoc(notaRef, notaData, { merge: true });
      }

      return { submitFinal };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notas-bimestre"] });
      refetchNotas();
      toast({
        title: data.submitFinal ? "Notas entregues!" : "Notas salvas!",
        description: data.submitFinal 
          ? "As notas foram entregues com sucesso. Não é possível mais editar."
          : "As notas foram salvas como rascunho.",
      });
      if (data.submitFinal) {
        setConfirmSubmitDialogOpen(false);
      }
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar notas",
        description: error.message,
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const getStatusBimestre = (bimestre: BimestreConfig) => {
    const now = new Date();
    const inicio = parseISO(bimestre.dataInicio);
    const fim = parseISO(bimestre.dataFim);
    const prazo = parseISO(bimestre.prazoLancamentoNotas);

    if (!bimestre.ativo) return { label: "Inativo", variant: "secondary" as const, icon: Lock };
    if (isBefore(now, inicio)) return { label: "Aguardando", variant: "outline" as const, icon: Clock };
    if (isAfter(now, prazo)) return { label: "Prazo Encerrado", variant: "destructive" as const, icon: AlertTriangle };
    if (isAfter(now, fim)) return { label: "Lançamento", variant: "default" as const, icon: Edit };
    return { label: "Em Andamento", variant: "default" as const, icon: Calendar };
  };

  const allNotasEntregues = notasLocais.every(n => n.status === "entregue");
  const hasAuthorizedEdits = useMemo(() => {
    return notasLocais.some(n => n.edicaoAutorizada);
  }, [notasLocais]);
  const canSave = useMemo(() => {
    if (userData?.tipo === "diretor") return true;
    if (hasAuthorizedEdits) return true;
    return canEdit;
  }, [userData, hasAuthorizedEdits, canEdit]);
  const hasChanges = useMemo(() => {
    return notasLocais.some(n => {
      const original = notasBimestre?.find(nb => nb.alunoId === n.alunoId);
      if (!original) return n.nota !== null || n.observacao !== "";
      return n.nota !== original.nota || n.observacao !== (original.observacao || "");
    });
  }, [notasLocais, notasBimestre]);

  const stats = useMemo(() => {
    const total = notasLocais.length;
    const comNota = notasLocais.filter(n => n.nota !== null).length;
    const entregues = notasLocais.filter(n => n.status === "entregue").length;
    const abaixoMedia = notasLocais.filter(n => 
      n.nota !== null && selectedBimestreData && n.nota < selectedBimestreData.mediaEsperada
    ).length;

    return { total, comNota, entregues, abaixoMedia };
  }, [notasLocais, selectedBimestreData]);

  if (loadingBimestres) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Lançamento de Notas por Bimestre
          </h2>
          <p className="text-muted-foreground">Lance as notas dos alunos para cada bimestre</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione o Período</CardTitle>
          <CardDescription>Escolha o ano, turma, bimestre e matéria para lançar as notas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={selectedAno} onValueChange={setSelectedAno}>
                <SelectTrigger data-testid="select-ano">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANOS_DISPONIVEIS.map(ano => (
                    <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedTurma} onValueChange={setSelectedTurma}>
                <SelectTrigger data-testid="select-turma">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {professorTurmas.map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bimestre</Label>
              <Select value={selectedBimestre} onValueChange={setSelectedBimestre} disabled={sortedBimestres.length === 0}>
                <SelectTrigger data-testid="select-bimestre">
                  <SelectValue placeholder={sortedBimestres.length === 0 ? "Nenhum configurado" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {sortedBimestres.map(bimestre => {
                    const status = getStatusBimestre(bimestre);
                    return (
                      <SelectItem key={bimestre.id} value={bimestre.id}>
                        <div className="flex items-center gap-2">
                          {bimestre.nome}
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Matéria</Label>
              <Select value={selectedMateria} onValueChange={setSelectedMateria}>
                <SelectTrigger data-testid="select-materia">
                  <SelectValue placeholder="Selecione a matéria" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAS_BOLETIM.map(materia => (
                    <SelectItem key={materia} value={materia}>{materia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedBimestreData && (
        <Card className={isPrazoExpirado ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Informações do Bimestre
              </CardTitle>
              <Badge variant={getStatusBimestre(selectedBimestreData).variant}>
                {getStatusBimestre(selectedBimestreData).label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Início:</span>
                <p className="font-medium">
                  {format(parseISO(selectedBimestreData.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim:</span>
                <p className="font-medium">
                  {format(parseISO(selectedBimestreData.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Prazo Notas:</span>
                <p className={`font-medium ${isPrazoExpirado ? "text-destructive" : "text-orange-600"}`}>
                  {format(parseISO(selectedBimestreData.prazoLancamentoNotas), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Média Esperada:</span>
                <p className="font-medium">{selectedBimestreData.mediaEsperada}</p>
              </div>
            </div>

            {isPrazoExpirado && userData?.tipo !== "diretor" && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm font-medium">O prazo para lançamento de notas expirou</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTurma && selectedBimestre && selectedMateria && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Alunos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Com Nota</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.comNota}</div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregues</CardTitle>
                <Send className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.entregues}</div>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abaixo da Média</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.abaixoMedia}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg">Lançar Notas</CardTitle>
                <CardDescription>
                  {turmas?.find(t => t.id === selectedTurma)?.nome} - {selectedMateria} - {selectedBimestreData?.nome}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate(false)}
                  disabled={isSaving || !canSave || !hasChanges || !isDataReady}
                  data-testid="button-save-rascunho"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Rascunho
                </Button>
                <Button
                  onClick={() => setConfirmSubmitDialogOpen(true)}
                  disabled={isSaving || !canSave || (allNotasEntregues && !hasAuthorizedEdits) || !isDataReady}
                  data-testid="button-entregar"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {hasAuthorizedEdits ? "Re-entregar Notas" : "Entregar Notas"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingNotas ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
                  <p className="text-muted-foreground">Carregando notas existentes...</p>
                </div>
              ) : notasLocais.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum aluno encontrado nesta turma</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="w-24">Matrícula</TableHead>
                        <TableHead className="w-32 text-center">Nota (0-10)</TableHead>
                        <TableHead className="w-48">Observação</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                        <TableHead className="w-32 text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notasLocais.map((nota, idx) => {
                        const abaixoMedia = nota.nota !== null && selectedBimestreData && nota.nota < selectedBimestreData.mediaEsperada;
                        const isEntregue = nota.status === "entregue";
                        const isAutorizado = nota.edicaoAutorizada;
                        const isDiretor = userData?.tipo === "diretor";
                        const canEditNota = isDiretor 
                          ? true 
                          : isAutorizado 
                            ? true 
                            : (canEdit && !isEntregue);
                        const solicitacao = getSolicitacaoParaAluno(nota.alunoId);

                        return (
                          <TableRow key={nota.alunoId} className={abaixoMedia ? "bg-orange-50 dark:bg-orange-950/20" : ""}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{nota.alunoNome}</TableCell>
                            <TableCell className="text-muted-foreground">{nota.alunoMatricula || "-"}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={nota.nota ?? ""}
                                onChange={(e) => handleNotaChange(nota.alunoId, e.target.value)}
                                disabled={!canEditNota}
                                className={`text-center ${abaixoMedia ? "border-orange-500" : ""} ${isAutorizado ? "border-green-500" : ""}`}
                                data-testid={`input-nota-${nota.alunoId}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={nota.observacao}
                                onChange={(e) => handleObservacaoChange(nota.alunoId, e.target.value)}
                                disabled={!canEditNota}
                                placeholder="Obs..."
                                className="text-sm"
                                data-testid={`input-obs-${nota.alunoId}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {isAutorizado ? (
                                <Badge variant="default" className="bg-green-600">
                                  <KeyRound className="h-3 w-3 mr-1" />
                                  Autorizado
                                </Badge>
                              ) : isEntregue ? (
                                <Badge variant="default">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Entregue
                                </Badge>
                              ) : nota.existingId ? (
                                <Badge variant="secondary">Rascunho</Badge>
                              ) : (
                                <Badge variant="outline">Pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isEntregue && !isAutorizado && !isDiretor && (
                                <>
                                  {solicitacao ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge 
                                        variant={
                                          solicitacao.status === "pendente" ? "outline" : 
                                          solicitacao.status === "autorizado" ? "default" : "destructive"
                                        }
                                        className="text-xs"
                                      >
                                        {solicitacao.status === "pendente" && <Clock className="h-3 w-3 mr-1" />}
                                        {solicitacao.status === "autorizado" && <CheckCircle className="h-3 w-3 mr-1" />}
                                        {solicitacao.status === "negado" && <AlertCircle className="h-3 w-3 mr-1" />}
                                        {solicitacao.status === "pendente" ? "Aguardando" : 
                                         solicitacao.status === "autorizado" ? "Autorizado" : "Negado"}
                                      </Badge>
                                      
                                      {solicitacao.comentarioDiretor && (
                                        <div className={`text-xs p-2 rounded max-w-[200px] ${
                                          solicitacao.status === "negado" 
                                            ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300" 
                                            : "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                        }`}>
                                          <MessageSquare className="h-3 w-3 inline mr-1" />
                                          {solicitacao.comentarioDiretor}
                                        </div>
                                      )}
                                      
                                      {(solicitacao.status === "negado" || solicitacao.status === "autorizado") && !isAutorizado && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openRequestAuthDialog(nota)}
                                          className="text-xs mt-1"
                                          data-testid={`button-retry-auth-${nota.alunoId}`}
                                        >
                                          <KeyRound className="h-3 w-3 mr-1" />
                                          {solicitacao.status === "negado" ? "Tentar novamente" : "Nova solicitação"}
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openRequestAuthDialog(nota)}
                                      data-testid={`button-request-auth-${nota.alunoId}`}
                                    >
                                      <KeyRound className="h-3 w-3 mr-1" />
                                      Solicitar
                                    </Button>
                                  )}
                                </>
                              )}
                              {isAutorizado && !isDiretor && (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge variant="default" className="bg-green-600 text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Autorizado
                                  </Badge>
                                  
                                  {solicitacao?.comentarioDiretor && (
                                    <div className="text-xs p-2 rounded max-w-[200px] bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300">
                                      <MessageSquare className="h-3 w-3 inline mr-1" />
                                      {solicitacao.comentarioDiretor}
                                    </div>
                                  )}
                                  
                                  <span className="text-xs text-muted-foreground">Editável</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openRequestAuthDialog(nota)}
                                    className="text-xs"
                                    data-testid={`button-new-auth-${nota.alunoId}`}
                                  >
                                    <KeyRound className="h-3 w-3 mr-1" />
                                    Nova solicitação
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedTurma && !selectedBimestre && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarClock className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Selecione os filtros acima</p>
            <p className="text-sm text-muted-foreground text-center">
              Escolha o ano, turma, bimestre e matéria para começar a lançar as notas
            </p>
          </CardContent>
        </Card>
      )}

      {sortedBimestres.length === 0 && selectedAno && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum bimestre configurado</p>
            <p className="text-sm text-muted-foreground text-center">
              Entre em contato com a diretoria para configurar os bimestres do ano {selectedAno}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmSubmitDialogOpen} onOpenChange={setConfirmSubmitDialogOpen}>
        <DialogContent data-testid="dialog-confirm-submit">
          <DialogHeader>
            <DialogTitle>Confirmar Entrega de Notas</DialogTitle>
            <DialogDescription>
              Ao entregar as notas, elas serão marcadas como finalizadas e não poderão mais ser editadas.
              Tem certeza que deseja continuar?
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p><strong>Turma:</strong> {turmas?.find(t => t.id === selectedTurma)?.nome}</p>
            <p><strong>Bimestre:</strong> {selectedBimestreData?.nome}</p>
            <p><strong>Matéria:</strong> {selectedMateria}</p>
            <p><strong>Alunos com nota:</strong> {stats.comNota} de {stats.total}</p>
          </div>

          {stats.comNota < stats.total && (
            <div className="p-3 bg-orange-100 dark:bg-orange-950/30 rounded-lg flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">Atenção: Alguns alunos ainda não têm nota lançada</span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmSubmitDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(true)}
              disabled={saveMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {saveMutation.isPending ? "Entregando..." : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={requestAuthDialogOpen} onOpenChange={setRequestAuthDialogOpen}>
        <DialogContent data-testid="dialog-request-auth">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Solicitar Autorização para Edição
            </DialogTitle>
            <DialogDescription>
              Solicite autorização ao diretor para alterar a nota já entregue deste aluno.
            </DialogDescription>
          </DialogHeader>

          {selectedNotaForAuth && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Aluno:</strong> {selectedNotaForAuth.alunoNome}</p>
                <p><strong>Matrícula:</strong> {selectedNotaForAuth.alunoMatricula || "-"}</p>
                <p><strong>Matéria:</strong> {selectedMateria}</p>
                <p><strong>Bimestre:</strong> {selectedBimestreData?.nome}</p>
                <p><strong>Nota atual:</strong> {selectedNotaForAuth.nota !== null ? selectedNotaForAuth.nota.toFixed(1) : "-"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo da solicitação *</Label>
                <Textarea
                  id="motivo"
                  value={motivoSolicitacao}
                  onChange={(e) => setMotivoSolicitacao(e.target.value)}
                  placeholder="Explique o motivo pelo qual precisa alterar esta nota..."
                  className="min-h-[100px]"
                  data-testid="input-motivo-solicitacao"
                />
                <p className="text-xs text-muted-foreground">
                  Descreva de forma clara o motivo da alteração. O diretor avaliará sua solicitação.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRequestAuthDialogOpen(false);
                setSelectedNotaForAuth(null);
                setMotivoSolicitacao("");
              }}
              data-testid="button-cancel-auth"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => requestAuthMutation.mutate()}
              disabled={requestAuthMutation.isPending || !motivoSolicitacao.trim()}
              data-testid="button-submit-auth"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {requestAuthMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
