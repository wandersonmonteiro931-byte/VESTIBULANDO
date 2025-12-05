import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, where, deleteDoc, getDocs, query, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Plus, FileText, Calendar, Eye, Edit, Trash2, Printer, 
  GraduationCap, Users, CheckCircle, Lock, Unlock, Download,
  ClipboardList, AlertCircle, Search, RefreshCw, ChevronDown, ChevronRight, Save, X, Clock
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useBimestreStatus } from "@/hooks/useBimestreStatus";
import type { Boletim, BoletimNota, User, Turma, BoletimConfig, Frequencia, NotaBimestre, BoletimDocumento } from "@shared/schema";
import { MATERIAS_BOLETIM } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import { formatNota } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PERIODOS_BIMESTRE = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"];
const PERIODOS_TRIMESTRE = ["1º Trimestre", "2º Trimestre", "3º Trimestre"];

export function BoletimTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedBoletim, setSelectedBoletim] = useState<Boletim | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTurma, setFilterTurma] = useState<string>("todas");
  const [filterSituacao, setFilterSituacao] = useState<string>("todas");
  const [filterBimestre, setFilterBimestre] = useState<string>("todos");
  
  const [selectedAlunoId, setSelectedAlunoId] = useState("");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [anoLetivo, setAnoLetivo] = useState(new Date().getFullYear().toString());
  const [periodoTipo, setPeriodoTipo] = useState<"bimestre" | "trimestre">("bimestre");
  const [selectedBimestreNumero, setSelectedBimestreNumero] = useState<number>(1);
  const [materiasNotas, setMateriasNotas] = useState<BoletimNota[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [situacao, setSituacao] = useState<"cursando" | "aprovado" | "reprovado">("cursando");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
  const [expandedAlunos, setExpandedAlunos] = useState<Set<string>>(new Set());
  const [editingBoletimId, setEditingBoletimId] = useState<string | null>(null);
  const [bulkEditNotas, setBulkEditNotas] = useState<Record<string, BoletimNota[]>>({});
  const [editingBoletimData, setEditingBoletimData] = useState<Boletim | null>(null);

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

  const { data: boletins, isLoading: loadingBoletins } = useRealtimeQuery<Boletim>({
    collectionName: "boletins",
    queryKey: ["/api/boletins"],
    transform: (docs) => docs as Boletim[],
  });

  const { data: boletimConfigs } = useRealtimeQuery<BoletimConfig>({
    collectionName: "boletimConfigs",
    queryKey: ["/api/boletim-configs"],
    transform: (docs) => docs as BoletimConfig[],
  });

  const { data: frequencias } = useRealtimeQuery<Frequencia>({
    collectionName: "frequencia",
    queryKey: ["/api/frequencia"],
    transform: (docs) => docs as Frequencia[],
  });

  const { data: notasBimestre } = useRealtimeQuery<NotaBimestre>({
    collectionName: "notasBimestre",
    queryKey: ["/api/notas-bimestre", anoLetivo],
    constraints: [where("ano", "==", anoLetivo)],
    transform: (docs) => docs as NotaBimestre[],
  });

  const { 
    currentBimestre, 
    bimestresInfo, 
    canEditBimestre, 
    canEmitBoletim,
    getBimestreStatus 
  } = useBimestreStatus(anoLetivo);

  const periodos = periodoTipo === "bimestre" ? PERIODOS_BIMESTRE : PERIODOS_TRIMESTRE;

  const frequenciaDoAluno = useMemo(() => {
    if (!selectedAlunoId || !frequencias || !anoLetivo) return { presencas: 0, faltas: 0 };
    
    const registros = frequencias.filter(f => {
      const matchAluno = f.alunoId === selectedAlunoId;
      const matchAno = f.data?.startsWith(anoLetivo);
      return matchAluno && matchAno;
    });
    
    const presencas = registros.filter(f => f.tipo === "presente").length;
    const faltas = registros.filter(f => f.tipo === "ausente" || f.tipo === "justificada").length;
    
    return { presencas, faltas };
  }, [selectedAlunoId, frequencias, anoLetivo]);

  const getFrequenciaAluno = (alunoId: string) => {
    if (!frequencias || !anoLetivo) return { presencas: 0, faltas: 0 };
    
    const registros = frequencias.filter(f => {
      const matchAluno = f.alunoId === alunoId;
      const matchAno = f.data?.startsWith(anoLetivo);
      return matchAluno && matchAno;
    });
    
    const presencas = registros.filter(f => f.tipo === "presente").length;
    const faltas = registros.filter(f => f.tipo === "ausente" || f.tipo === "justificada").length;
    
    return { presencas, faltas };
  };

  const filteredBoletins = useMemo(() => {
    if (!boletins) return [];
    return boletins.filter(b => {
      const matchSearch = b.alunoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         b.turmaNome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTurma = filterTurma === "todas" || b.turmaId === filterTurma;
      const matchSituacao = filterSituacao === "todas" || b.situacao === filterSituacao;
      
      let matchBimestre = true;
      if (filterBimestre !== "todos") {
        const bimestreNum = parseInt(filterBimestre);
        matchBimestre = (b.bimestreNumero || 1) === bimestreNum;
      }
      
      return matchSearch && matchTurma && matchSituacao && matchBimestre;
    });
  }, [boletins, searchTerm, filterTurma, filterSituacao, filterBimestre]);

  const initializeMateriasNotas = () => {
    const materias: BoletimNota[] = MATERIAS_BOLETIM.map(materia => ({
      materia,
      notas: Object.fromEntries(periodos.map(p => [p, null])),
      mediaFinal: null,
      mediaEsperada: 7,
    }));
    setMateriasNotas(materias);
  };

  const bimestreToNomePeriodo = (numero: number): string => {
    return `${numero}º Bimestre`;
  };

  const carregarNotasProfessores = (alunoId: string) => {
    if (!notasBimestre || !alunoId || !selectedTurmaId) return;

    const notasAluno = notasBimestre.filter(n => 
      n.alunoId === alunoId && 
      n.status === "entregue" &&
      n.turmaId === selectedTurmaId &&
      n.ano === anoLetivo
    );

    const materias: BoletimNota[] = MATERIAS_BOLETIM.map(materia => {
      const notas: Record<string, number | null> = {};
      periodos.forEach(periodo => {
        notas[periodo] = null;
      });

      notasAluno
        .filter(n => n.materia === materia)
        .forEach(n => {
          const periodoNome = periodoTipo === "bimestre" 
            ? `${n.bimestreNumero}º Bimestre` 
            : `${n.bimestreNumero}º Trimestre`;
          if (notas.hasOwnProperty(periodoNome)) {
            notas[periodoNome] = n.nota;
          }
        });

      const valores = Object.values(notas).filter((n): n is number => n !== null);
      const mediaFinal = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

      return {
        materia,
        notas,
        mediaFinal,
        mediaEsperada: 7,
      };
    });

    setMateriasNotas(materias);
    return materias;
  };

  const getNotasFromProfessores = (alunoId: string, turmaId: string): BoletimNota[] => {
    if (!notasBimestre || !alunoId || !turmaId) return [];

    const notasAluno = notasBimestre.filter(n => 
      n.alunoId === alunoId && 
      n.status === "entregue" &&
      n.turmaId === turmaId &&
      n.ano === anoLetivo
    );

    return MATERIAS_BOLETIM.map(materia => {
      const notas: Record<string, number | null> = {};
      periodos.forEach(periodo => {
        notas[periodo] = null;
      });

      notasAluno
        .filter(n => n.materia === materia)
        .forEach(n => {
          const periodoNome = periodoTipo === "bimestre" 
            ? `${n.bimestreNumero}º Bimestre` 
            : `${n.bimestreNumero}º Trimestre`;
          if (notas.hasOwnProperty(periodoNome)) {
            notas[periodoNome] = n.nota;
          }
        });

      const valores = Object.values(notas).filter((n): n is number => n !== null);
      const mediaFinal = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

      return {
        materia,
        notas,
        mediaFinal,
        mediaEsperada: 7,
      };
    });
  };

  const countNotasDisponiveis = (alunoId: string): number => {
    if (!notasBimestre || !alunoId || !selectedTurmaId) return 0;
    return notasBimestre.filter(n => 
      n.alunoId === alunoId && 
      n.status === "entregue" &&
      n.turmaId === selectedTurmaId &&
      n.ano === anoLetivo
    ).length;
  };

  const getBoletinsExistentes = useMemo(() => {
    if (!boletins || !selectedAlunoId || !selectedTurmaId || !anoLetivo) return [];
    return boletins.filter(b => 
      b.alunoId === selectedAlunoId && 
      b.turmaId === selectedTurmaId && 
      b.anoLetivo === anoLetivo
    );
  }, [boletins, selectedAlunoId, selectedTurmaId, anoLetivo]);

  const bimestresDisponiveis = useMemo(() => {
    const bimestresUsados = new Set(getBoletinsExistentes.map(b => b.bimestreNumero || 1));
    return [1, 2, 3, 4].filter(b => !bimestresUsados.has(b));
  }, [getBoletinsExistentes]);

  const getProximoBimestreDisponivel = (): number => {
    if (bimestresDisponiveis.length === 0) return 0;
    return Math.min(...bimestresDisponiveis);
  };

  const carregarNotasBimestresAnteriores = (bimestreAtual: number): BoletimNota[] => {
    const materiasBase: BoletimNota[] = MATERIAS_BOLETIM.map(materia => ({
      materia,
      notas: Object.fromEntries(periodos.map(p => [p, null])),
      mediaFinal: null,
      mediaEsperada: 7,
    }));

    if (!boletins || !selectedAlunoId || !selectedTurmaId) {
      return materiasBase;
    }

    const boletinsAnteriores = boletins.filter(b => 
      b.alunoId === selectedAlunoId && 
      b.turmaId === selectedTurmaId && 
      b.anoLetivo === anoLetivo &&
      (b.bimestreNumero || 1) < bimestreAtual
    ).sort((a, b) => (a.bimestreNumero || 1) - (b.bimestreNumero || 1));

    boletinsAnteriores.forEach(boletim => {
      boletim.materias?.forEach(materiaBoletim => {
        const materiaTarget = materiasBase.find(m => m.materia === materiaBoletim.materia);
        if (materiaTarget && materiaBoletim.notas) {
          Object.entries(materiaBoletim.notas).forEach(([periodo, nota]) => {
            if (materiaTarget.notas.hasOwnProperty(periodo) && nota !== null) {
              materiaTarget.notas[periodo] = nota;
            }
          });
        }
      });
    });

    if (notasBimestre) {
      const notasProfessoresAluno = notasBimestre.filter(n => 
        n.alunoId === selectedAlunoId && 
        n.status === "entregue" &&
        n.turmaId === selectedTurmaId &&
        n.ano === anoLetivo &&
        n.bimestreNumero === bimestreAtual
      );

      notasProfessoresAluno.forEach(nota => {
        const materiaTarget = materiasBase.find(m => m.materia === nota.materia);
        if (materiaTarget) {
          const periodoNome = `${nota.bimestreNumero}º Bimestre`;
          if (materiaTarget.notas.hasOwnProperty(periodoNome)) {
            materiaTarget.notas[periodoNome] = nota.nota;
          }
        }
      });
    }

    materiasBase.forEach(materia => {
      const valores = Object.values(materia.notas).filter((n): n is number => n !== null);
      materia.mediaFinal = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
    });

    return materiasBase;
  };

  const initializeMateriasNotasReturn = (): BoletimNota[] => {
    return MATERIAS_BOLETIM.map(materia => ({
      materia,
      notas: Object.fromEntries(periodos.map(p => [p, null])),
      mediaFinal: null,
      mediaEsperada: 7,
    }));
  };

  const calcularMediaMateria = (notas: Record<string, number | null>): number | null => {
    const valores = Object.values(notas).filter((n): n is number => n !== null);
    if (valores.length === 0) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  };

  const calcularMediaGeral = (materias: BoletimNota[]): number | null => {
    const medias = materias
      .map(m => m.mediaFinal)
      .filter((m): m is number => m !== null);
    if (medias.length === 0) return null;
    return medias.reduce((a, b) => a + b, 0) / medias.length;
  };

  const [notasTextoBoletim, setNotasTextoBoletim] = useState<Record<string, string>>({});

  const handleNotaChange = (materiaIndex: number, periodo: string, valor: string) => {
    const cleanValue = valor.replace(/[^0-9,\.]/g, "");
    const key = `${materiaIndex}-${periodo}`;
    
    setNotasTextoBoletim(prev => ({ ...prev, [key]: cleanValue }));
    
    const novaNotas = [...materiasNotas];
    
    if (cleanValue === "") {
      novaNotas[materiaIndex].notas[periodo] = null;
      novaNotas[materiaIndex].mediaFinal = calcularMediaMateria(novaNotas[materiaIndex].notas);
      setMateriasNotas(novaNotas);
      return;
    }
    
    const normalized = cleanValue.replace(",", ".");
    const parsedNota = parseFloat(normalized);
    
    if (!isNaN(parsedNota) && parsedNota >= 0 && parsedNota <= 10) {
      novaNotas[materiaIndex].notas[periodo] = parsedNota;
      novaNotas[materiaIndex].mediaFinal = calcularMediaMateria(novaNotas[materiaIndex].notas);
      setMateriasNotas(novaNotas);
    }
  };

  const getNotaBoletimDisplayValue = (materiaIndex: number, periodo: string, notaValue: number | null): string => {
    const key = `${materiaIndex}-${periodo}`;
    if (notasTextoBoletim[key] !== undefined) {
      return notasTextoBoletim[key];
    }
    return notaValue !== null ? formatNota(notaValue) : "";
  };

  const openCreateDialog = () => {
    setSelectedBoletim(null);
    setEditingBoletimData(null);
    setSelectedAlunoId("");
    setSelectedTurmaId("");
    setAnoLetivo(new Date().getFullYear().toString());
    setPeriodoTipo("bimestre");
    setSelectedBimestreNumero(1);
    initializeMateriasNotas();
    setObservacoes("");
    setSituacao("cursando");
    setNotasTextoBoletim({});
    setCreateDialogOpen(true);
  };

  const openEditDialog = (boletim: Boletim) => {
    setEditingBoletimData(boletim);
    setSelectedBoletim(boletim);
    setSelectedAlunoId(boletim.alunoId);
    setSelectedTurmaId(boletim.turmaId || "");
    setAnoLetivo(boletim.anoLetivo);
    setPeriodoTipo(boletim.periodoTipo);
    setSelectedBimestreNumero(boletim.bimestreNumero || 1);
    setMateriasNotas(boletim.materias);
    setObservacoes(boletim.observacoes || "");
    setSituacao(boletim.situacao);
    setNotasTextoBoletim({});
    setCreateDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userData) throw new Error("Usuário não autenticado");
      if (!selectedAlunoId) throw new Error("Selecione um aluno");
      if (!selectedTurmaId) throw new Error("Selecione uma turma");
      if (!selectedBimestreNumero || selectedBimestreNumero < 1 || selectedBimestreNumero > 4) {
        throw new Error("Selecione um bimestre válido (1-4)");
      }

      if (!canEmitBoletim(selectedBimestreNumero, userData.tipo)) {
        const bimestreStatus = getBimestreStatus(selectedBimestreNumero);
        throw new Error(`Não é possível emitir boletim para o ${selectedBimestreNumero}º Bimestre. Status: ${bimestreStatus.statusLabel}. ${currentBimestre ? `Apenas o ${currentBimestre.numero}º Bimestre está aberto para emissão.` : "Nenhum bimestre está aberto para emissão no momento."}`);
      }

      const aluno = alunos?.find(a => a.uid === selectedAlunoId);
      const turma = turmas?.find(t => t.id === selectedTurmaId);
      
      if (!aluno || !turma) throw new Error("Aluno ou turma não encontrados");

      const boletimId = `${selectedAlunoId}_${selectedTurmaId}_${anoLetivo}_${selectedBimestreNumero}`;
      
      const existingDoc = await getDoc(doc(db, "boletins", boletimId));
      if (existingDoc.exists()) {
        throw new Error(`Já existe um boletim para o ${selectedBimestreNumero}º Bimestre deste aluno nesta turma e ano. Use a opção de edição.`);
      }

      const mediaGeral = calcularMediaGeral(materiasNotas);
      const presencasCalc = frequenciaDoAluno.presencas;
      const faltasCalc = frequenciaDoAluno.faltas;
      const percentualPresenca = (presencasCalc + faltasCalc) > 0 
        ? (presencasCalc / (presencasCalc + faltasCalc)) * 100 
        : null;

      const boletimData: any = {
        id: boletimId,
        alunoId: selectedAlunoId,
        alunoNome: aluno.nome,
        alunoMatricula: aluno.matricula,
        escola: "Preparatório Vestibulando",
        turmaId: selectedTurmaId,
        turmaNome: turma.nome,
        anoLetivo,
        bimestreNumero: selectedBimestreNumero,
        periodoTipo,
        periodos,
        materias: materiasNotas,
        mediaGeral,
        mediaGeralEsperada: 7,
        situacao,
        presencas: presencasCalc,
        faltas: faltasCalc,
        percentualPresenca,
        observacoes,
        liberado: false,
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: getNowBrasiliaISO(),
      };

      await setDoc(doc(db, "boletins", boletimId), boletimData);
      return boletimData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      toast({
        title: "Boletim criado!",
        description: "O boletim foi criado com sucesso.",
      });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar boletim",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!userData || !selectedBoletim) throw new Error("Erro ao atualizar");

      const boletimBimestre = selectedBoletim.bimestreNumero || 1;
      if (!canEditBimestre(boletimBimestre, userData.tipo)) {
        const bimestreStatus = getBimestreStatus(boletimBimestre);
        throw new Error(`Não é possível editar boletim do ${boletimBimestre}º Bimestre. Status: ${bimestreStatus.statusLabel}. ${currentBimestre ? `Apenas o ${currentBimestre.numero}º Bimestre está aberto para edição.` : "Nenhum bimestre está aberto para edição no momento."}`);
      }

      const mediaGeral = calcularMediaGeral(materiasNotas);
      const presencasCalc = frequenciaDoAluno.presencas;
      const faltasCalc = frequenciaDoAluno.faltas;
      const percentualPresenca = (presencasCalc + faltasCalc) > 0 
        ? (presencasCalc / (presencasCalc + faltasCalc)) * 100 
        : null;

      const boletimData: any = {
        materias: materiasNotas,
        mediaGeral,
        situacao,
        presencas: presencasCalc,
        faltas: faltasCalc,
        percentualPresenca,
        observacoes,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      await updateDoc(doc(db, "boletins", selectedBoletim.id), boletimData);
      
      if (selectedBoletim.liberado) {
        const updatedBoletim: Boletim = {
          ...selectedBoletim,
          ...boletimData,
        };
        const pdfBase64 = generateBoletimPdfBase64(updatedBoletim);
        await saveBoletimDocumento(updatedBoletim, pdfBase64);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boletim-documentos"] });
      toast({
        title: "Boletim atualizado!",
        description: selectedBoletim?.liberado 
          ? "As alterações foram salvas e o PDF foi atualizado na documentação."
          : "As alterações foram salvas.",
      });
      setEditDialogOpen(false);
      setSelectedBoletim(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleReleaseMutation = useMutation({
    mutationFn: async ({ boletimId, liberar, boletim }: { boletimId: string; liberar: boolean; boletim: Boletim }) => {
      if (!userData) throw new Error("Usuário não autenticado");

      const boletimBimestre = boletim.bimestreNumero || 1;
      if (!canEditBimestre(boletimBimestre, userData.tipo)) {
        const bimestreStatus = getBimestreStatus(boletimBimestre);
        throw new Error(`Não é possível ${liberar ? "liberar" : "bloquear"} boletim do ${boletimBimestre}º Bimestre. Status: ${bimestreStatus.statusLabel}.`);
      }

      const updateData: any = {
        liberado: liberar,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      if (liberar) {
        updateData.liberadoEm = getNowBrasiliaISO();
        updateData.liberadoPor = userData.uid;
        updateData.liberadoPorNome = userData.nome;
      }

      await updateDoc(doc(db, "boletins", boletimId), updateData);
      
      if (liberar) {
        const pdfBase64 = generateBoletimPdfBase64(boletim);
        await saveBoletimDocumento(boletim, pdfBase64);
      } else {
        await removeBoletimDocumento(boletimId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boletim-documentos"] });
      toast({
        title: variables.liberar ? "Boletim liberado!" : "Boletim bloqueado!",
        description: variables.liberar 
          ? "O aluno pode visualizar o boletim agora. PDF anexado à documentação." 
          : "O boletim não está mais visível para o aluno. PDF removido da documentação.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ boletimId, boletim }: { boletimId: string; boletim: Boletim }) => {
      if (!userData) throw new Error("Usuário não autenticado");

      const boletimBimestre = boletim.bimestreNumero || 1;
      if (!canEditBimestre(boletimBimestre, userData.tipo)) {
        const bimestreStatus = getBimestreStatus(boletimBimestre);
        throw new Error(`Não é possível excluir boletim do ${boletimBimestre}º Bimestre. Status: ${bimestreStatus.statusLabel}. ${currentBimestre ? `Apenas o ${currentBimestre.numero}º Bimestre está aberto para edição.` : "Nenhum bimestre está aberto para edição no momento."}`);
      }

      await removeBoletimDocumento(boletimId);
      await deleteDoc(doc(db, "boletins", boletimId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boletim-documentos"] });
      toast({
        title: "Boletim excluído",
        description: "O boletim e seu PDF foram removidos do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBulkCreate = async () => {
    if (!userData || !selectedTurmaId) return;

    const turma = turmas?.find(t => t.id === selectedTurmaId);
    if (!turma) return;

    const bimestreParaCriar = selectedBimestreNumero;

    if (!canEmitBoletim(bimestreParaCriar, userData.tipo)) {
      const bimestreStatus = getBimestreStatus(bimestreParaCriar);
      toast({
        title: "Bimestre não disponível",
        description: `Não é possível criar boletins para o ${bimestreParaCriar}º Bimestre. Status: ${bimestreStatus.statusLabel}. ${currentBimestre ? `Apenas o ${currentBimestre.numero}º Bimestre está aberto para emissão.` : "Nenhum bimestre está aberto para emissão no momento."}`,
        variant: "destructive",
      });
      return;
    }

    const alunosParaCriar = alunosDaTurma.filter(aluno => {
      const jaTemBoletimBimestre = boletins?.some(
        b => b.alunoId === aluno.uid && 
             b.turmaId === selectedTurmaId && 
             b.anoLetivo === anoLetivo &&
             (b.bimestreNumero || 1) === bimestreParaCriar
      );
      return !jaTemBoletimBimestre;
    });

    if (alunosParaCriar.length === 0) {
      toast({
        title: "Nenhum boletim para criar",
        description: `Todos os alunos da turma já possuem boletim para o ${bimestreParaCriar}º Bimestre deste ano letivo.`,
        variant: "destructive",
      });
      return;
    }

    setBulkCreating(true);
    setBulkProgress({ current: 0, total: alunosParaCriar.length });

    let created = 0;
    let errors = 0;

    for (const aluno of alunosParaCriar) {
      try {
        const boletimId = `${aluno.uid}_${selectedTurmaId}_${anoLetivo}_${bimestreParaCriar}`;
        
        const existingDoc = await getDoc(doc(db, "boletins", boletimId));
        if (existingDoc.exists()) {
          errors++;
          continue;
        }

        const notasAluno = getNotasFromProfessores(aluno.uid, selectedTurmaId);
        const mediaGeral = calcularMediaGeral(notasAluno);
        const freq = getFrequenciaAluno(aluno.uid);
        const percentualPresenca = (freq.presencas + freq.faltas) > 0 
          ? (freq.presencas / (freq.presencas + freq.faltas)) * 100 
          : null;

        const boletimData: any = {
          id: boletimId,
          alunoId: aluno.uid,
          alunoNome: aluno.nome,
          alunoMatricula: aluno.matricula,
          escola: "Preparatório Vestibulando",
          turmaId: selectedTurmaId,
          turmaNome: turma.nome,
          anoLetivo,
          bimestreNumero: bimestreParaCriar,
          periodoTipo,
          periodos,
          materias: notasAluno,
          mediaGeral,
          mediaGeralEsperada: 7,
          situacao: "cursando",
          presencas: freq.presencas,
          faltas: freq.faltas,
          percentualPresenca,
          observacoes: "",
          liberado: false,
          criadoPor: userData.uid,
          criadoPorNome: userData.nome,
          dataCriacao: getNowBrasiliaISO(),
        };

        await setDoc(doc(db, "boletins", boletimId), boletimData);
        created++;
      } catch (error) {
        console.error(`Erro ao criar boletim para ${aluno.nome}:`, error);
        errors++;
      }
      setBulkProgress({ current: created + errors, total: alunosParaCriar.length });
    }

    setBulkCreating(false);
    queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
    setBulkDialogOpen(false);

    toast({
      title: "Boletins criados em lote!",
      description: `${created} boletins criados com sucesso${errors > 0 ? `, ${errors} com erro` : ""}.`,
    });
  };

  const handleBulkRelease = async (liberar: boolean) => {
    if (!selectedTurmaId || !userData) return;

    const boletinsDaTurma = boletins?.filter(
      b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo && b.liberado !== liberar
    ) || [];

    if (boletinsDaTurma.length === 0) {
      toast({
        title: liberar ? "Nenhum boletim para liberar" : "Nenhum boletim para bloquear",
        description: `Todos os boletins da turma já estão ${liberar ? "liberados" : "bloqueados"}.`,
        variant: "destructive",
      });
      return;
    }

    const boletinsEditaveis = boletinsDaTurma.filter(b => {
      const bimNum = b.bimestreNumero || 1;
      return canEditBimestre(bimNum, userData.tipo);
    });

    if (boletinsEditaveis.length === 0) {
      toast({
        title: "Bimestre não disponível",
        description: `Nenhum boletim pode ser ${liberar ? "liberado" : "bloqueado"} porque todos pertencem a bimestres encerrados ou não disponíveis.`,
        variant: "destructive",
      });
      return;
    }

    setBulkCreating(true);
    setBulkProgress({ current: 0, total: boletinsEditaveis.length });

    let processed = 0;
    let skipped = boletinsDaTurma.length - boletinsEditaveis.length;

    for (const boletim of boletinsEditaveis) {
      try {
        const updateData: any = {
          liberado: liberar,
          dataAtualizacao: getNowBrasiliaISO(),
        };

        if (liberar && userData) {
          updateData.liberadoEm = getNowBrasiliaISO();
          updateData.liberadoPor = userData.uid;
          updateData.liberadoPorNome = userData.nome;
        }

        await updateDoc(doc(db, "boletins", boletim.id), updateData);
        processed++;
      } catch (error) {
        console.error(`Erro ao ${liberar ? "liberar" : "bloquear"} boletim:`, error);
      }
      setBulkProgress({ current: processed, total: boletinsEditaveis.length });
    }

    setBulkCreating(false);
    queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
    setBulkDialogOpen(false);

    toast({
      title: liberar ? "Boletins liberados!" : "Boletins bloqueados!",
      description: `${processed} boletins ${liberar ? "liberados" : "bloqueados"} com sucesso.${skipped > 0 ? ` ${skipped} boletins ignorados (bimestre encerrado).` : ""}`,
    });
  };

  const handlePrintAllBoletins = () => {
    const boletinsDaTurma = boletins?.filter(
      b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo
    ) || [];

    if (boletinsDaTurma.length === 0) {
      toast({
        title: "Nenhum boletim para imprimir",
        description: "Não há boletins para esta turma e ano letivo.",
        variant: "destructive",
      });
      return;
    }

    boletinsDaTurma.forEach(boletim => {
      handlePrintBoletim(boletim);
    });

    toast({
      title: "Boletins gerados!",
      description: `${boletinsDaTurma.length} PDFs foram gerados.`,
    });
  };

  const handlePrintSelected = () => {
    if (selectedForPrint.size === 0) {
      toast({
        title: "Nenhum boletim selecionado",
        description: "Selecione ao menos um aluno para imprimir.",
        variant: "destructive",
      });
      return;
    }

    const boletinsParaImprimir = boletins?.filter(
      b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo && selectedForPrint.has(b.alunoId)
    ) || [];

    if (boletinsParaImprimir.length === 0) {
      toast({
        title: "Nenhum boletim encontrado",
        description: "Os alunos selecionados não possuem boletim.",
        variant: "destructive",
      });
      return;
    }

    boletinsParaImprimir.forEach(boletim => {
      handlePrintBoletim(boletim);
    });

    toast({
      title: "Boletins gerados!",
      description: `${boletinsParaImprimir.length} PDFs foram gerados.`,
    });
  };

  const toggleSelectForPrint = (alunoId: string) => {
    const newSet = new Set(selectedForPrint);
    if (newSet.has(alunoId)) {
      newSet.delete(alunoId);
    } else {
      newSet.add(alunoId);
    }
    setSelectedForPrint(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedForPrint.size === alunosDaTurma.length) {
      setSelectedForPrint(new Set());
    } else {
      setSelectedForPrint(new Set(alunosDaTurma.map(a => a.uid)));
    }
  };

  const toggleExpandAluno = (alunoId: string) => {
    const newSet = new Set(expandedAlunos);
    if (newSet.has(alunoId)) {
      newSet.delete(alunoId);
    } else {
      newSet.add(alunoId);
    }
    setExpandedAlunos(newSet);
  };

  const checkBoletimComplete = (boletim: Boletim | undefined): { complete: boolean; missingItems: string[] } => {
    if (!boletim) return { complete: false, missingItems: ["Boletim não criado"] };
    
    const missingItems: string[] = [];
    
    const periodoCount = boletim.periodos?.length || (boletim.periodoTipo === "trimestre" ? 3 : 4);
    const periodoLabel = boletim.periodoTipo === "trimestre" ? "trimestre(s)" : "bimestre(s)";
    
    const materiasComNota = boletim.materias.filter(m => {
      const valores = Object.values(m.notas).filter((n): n is number => n !== null);
      return valores.length > 0;
    });
    
    if (materiasComNota.length === 0) {
      missingItems.push("Nenhuma nota lançada");
    } else if (materiasComNota.length < boletim.materias.length) {
      missingItems.push(`${boletim.materias.length - materiasComNota.length} matérias sem notas`);
    }
    
    boletim.materias.forEach(m => {
      const notasCompletas = Object.values(m.notas).filter((n): n is number => n !== null);
      if (notasCompletas.length > 0 && notasCompletas.length < periodoCount) {
        missingItems.push(`${m.materia}: faltam ${periodoCount - notasCompletas.length} ${periodoLabel}`);
      }
    });
    
    if (boletim.presencas === 0 && boletim.faltas === 0) {
      missingItems.push("Frequência não registrada");
    }
    
    return { complete: missingItems.length === 0, missingItems };
  };

  const startEditingBoletim = (boletimId: string, materias: BoletimNota[]) => {
    setEditingBoletimId(boletimId);
    setBulkEditNotas({ ...bulkEditNotas, [boletimId]: JSON.parse(JSON.stringify(materias)) });
  };

  const cancelEditingBoletim = () => {
    setEditingBoletimId(null);
  };

  const handleBulkNotaChange = (boletimId: string, materiaIndex: number, periodo: string, valor: string) => {
    const notas = bulkEditNotas[boletimId];
    if (!notas) return;
    
    const novaNotas = [...notas];
    const nota = valor === "" ? null : parseFloat(valor);
    novaNotas[materiaIndex].notas[periodo] = nota;
    novaNotas[materiaIndex].mediaFinal = calcularMediaMateria(novaNotas[materiaIndex].notas);
    setBulkEditNotas({ ...bulkEditNotas, [boletimId]: novaNotas });
  };

  const saveEditingBoletim = async (boletimId: string, alunoId?: string) => {
    const notas = bulkEditNotas[boletimId];
    if (!notas || !userData) return;
    
    try {
      const mediaGeral = calcularMediaGeral(notas);
      const updateData: any = {
        materias: notas,
        mediaGeral,
        dataAtualizacao: getNowBrasiliaISO(),
      };
      
      if (alunoId) {
        const freq = getFrequenciaAluno(alunoId);
        updateData.presencas = freq.presencas;
        updateData.faltas = freq.faltas;
        updateData.percentualPresenca = (freq.presencas + freq.faltas) > 0 
          ? (freq.presencas / (freq.presencas + freq.faltas)) * 100 
          : null;
      }
      
      await updateDoc(doc(db, "boletins", boletimId), updateData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      setEditingBoletimId(null);
      
      toast({
        title: "Boletim atualizado!",
        description: "As notas e frequência foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateSingleBoletim = async (aluno: User) => {
    if (!selectedTurmaId || !userData) return;
    
    setBulkCreating(true);
    
    try {
      const turma = turmas?.find(t => t.id === selectedTurmaId);
      const bimestreParaCriar = selectedBimestreNumero;
      const boletimId = `${aluno.uid}_${selectedTurmaId}_${anoLetivo}_${bimestreParaCriar}`;
      
      const existingDoc = await getDoc(doc(db, "boletins", boletimId));
      if (existingDoc.exists()) {
        throw new Error(`Já existe um boletim para o ${bimestreParaCriar}º Bimestre deste aluno.`);
      }
      
      const notasAluno = getNotasFromProfessores(aluno.uid, selectedTurmaId);
      const mediaGeral = calcularMediaGeral(notasAluno);
      const freq = getFrequenciaAluno(aluno.uid);
      const percentualPresenca = (freq.presencas + freq.faltas) > 0 
        ? (freq.presencas / (freq.presencas + freq.faltas)) * 100 
        : null;
      
      const novoBoletim: any = {
        id: boletimId,
        alunoId: aluno.uid,
        alunoNome: aluno.nome,
        alunoMatricula: aluno.matricula || "",
        turmaId: selectedTurmaId,
        turmaNome: turma?.nome || "",
        anoLetivo,
        bimestreNumero: bimestreParaCriar,
        periodoTipo,
        periodos,
        materias: notasAluno,
        mediaGeral,
        presencas: freq.presencas,
        faltas: freq.faltas,
        percentualPresenca,
        situacao: "cursando",
        liberado: false,
        escola: "Preparatório Vestibulando",
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: getNowBrasiliaISO(),
        dataAtualizacao: getNowBrasiliaISO(),
      };
      
      await setDoc(doc(db, "boletins", boletimId), novoBoletim);
      
      queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
      
      toast({
        title: "Boletim criado!",
        description: `Boletim de ${aluno.nome} foi criado com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar boletim",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBulkCreating(false);
    }
  };

  const refreshAllNotasFromProfessores = async () => {
    if (!selectedTurmaId || !userData) return;
    
    const boletinsDaTurma = boletins?.filter(
      b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo
    ) || [];
    
    if (boletinsDaTurma.length === 0) {
      toast({
        title: "Nenhum boletim para atualizar",
        description: "Crie os boletins primeiro.",
        variant: "destructive",
      });
      return;
    }
    
    setBulkCreating(true);
    setBulkProgress({ current: 0, total: boletinsDaTurma.length });
    
    let updated = 0;
    
    for (const boletim of boletinsDaTurma) {
      try {
        const notasAluno = getNotasFromProfessores(boletim.alunoId, selectedTurmaId);
        const mediaGeral = calcularMediaGeral(notasAluno);
        const freq = getFrequenciaAluno(boletim.alunoId);
        const percentualPresenca = (freq.presencas + freq.faltas) > 0 
          ? (freq.presencas / (freq.presencas + freq.faltas)) * 100 
          : null;
        
        await updateDoc(doc(db, "boletins", boletim.id), {
          materias: notasAluno,
          mediaGeral,
          presencas: freq.presencas,
          faltas: freq.faltas,
          percentualPresenca,
          dataAtualizacao: getNowBrasiliaISO(),
        });
        
        updated++;
      } catch (error) {
        console.error(`Erro ao atualizar boletim:`, error);
      }
      setBulkProgress({ current: updated, total: boletinsDaTurma.length });
    }
    
    setBulkCreating(false);
    queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
    
    toast({
      title: "Notas atualizadas!",
      description: `${updated} boletins foram atualizados com notas dos professores.`,
    });
  };

  const refreshAllBoletinsNotas = async () => {
    if (!userData) return;
    
    const todosBoletins = boletins?.filter(b => b.anoLetivo === anoLetivo) || [];
    
    if (todosBoletins.length === 0) {
      toast({
        title: "Nenhum boletim para atualizar",
        description: "Não há boletins cadastrados para este ano.",
        variant: "destructive",
      });
      return;
    }
    
    setBulkCreating(true);
    setBulkProgress({ current: 0, total: todosBoletins.length });
    
    let updated = 0;
    
    for (const boletim of todosBoletins) {
      try {
        const notasAluno = getNotasFromProfessores(boletim.alunoId, boletim.turmaId || "");
        const mediaGeral = calcularMediaGeral(notasAluno);
        const freq = getFrequenciaAluno(boletim.alunoId);
        const percentualPresenca = (freq.presencas + freq.faltas) > 0 
          ? (freq.presencas / (freq.presencas + freq.faltas)) * 100 
          : null;
        
        await updateDoc(doc(db, "boletins", boletim.id), {
          materias: notasAluno,
          mediaGeral,
          presencas: freq.presencas,
          faltas: freq.faltas,
          percentualPresenca,
          dataAtualizacao: getNowBrasiliaISO(),
        });
        
        updated++;
      } catch (error) {
        console.error(`Erro ao atualizar boletim:`, error);
      }
      setBulkProgress({ current: updated, total: todosBoletins.length });
    }
    
    setBulkCreating(false);
    queryClient.invalidateQueries({ queryKey: ["/api/boletins"] });
    
    toast({
      title: "Notas atualizadas!",
      description: `${updated} boletins foram atualizados com notas dos professores.`,
    });
  };

  const handlePrintBoletim = (boletim: Boletim) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("BOLETIM ESCOLAR", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(12);
    doc.text(boletim.escola || "Preparatório Vestibulando", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Aluno: ${boletim.alunoNome}`, margin, yPos);
    doc.text(`Matrícula: ${boletim.alunoMatricula || "-"}`, pageWidth - margin - 50, yPos);
    yPos += 6;
    
    doc.text(`Turma: ${boletim.turmaNome}`, margin, yPos);
    doc.text(`Ano Letivo: ${boletim.anoLetivo}`, pageWidth - margin - 50, yPos);
    yPos += 10;

    const periodos = boletim.periodos || (boletim.periodoTipo === "bimestre" ? PERIODOS_BIMESTRE : PERIODOS_TRIMESTRE);
    
    const tableHead = [["Matéria", ...periodos, "Média Final", "Média Mínima Esperada"]];
    const tableBody = boletim.materias.map(m => [
      m.materia,
      ...periodos.map(p => formatNota(m.notas[p])),
      formatNota(m.mediaFinal),
      formatNota(m.mediaEsperada || 7),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: tableHead,
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.text(`Média Final Anual: ${formatNota(boletim.mediaGeral)}`, margin, yPos);
    doc.text(`Situação: ${boletim.situacao.toUpperCase()}`, pageWidth - margin - 50, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.text(`Presenças: ${boletim.presencas}`, margin, yPos);
    doc.text(`Faltas: ${boletim.faltas}`, margin + 50, yPos);
    doc.text(`Frequência: ${boletim.percentualPresenca !== null && boletim.percentualPresenca !== undefined ? boletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}`, margin + 100, yPos);
    yPos += 10;

    if (boletim.observacoes) {
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", margin, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      const obsLines = doc.splitTextToSize(boletim.observacoes, pageWidth - 2 * margin);
      doc.text(obsLines, margin, yPos);
      yPos += obsLines.length * 5 + 10;
    }

    yPos = Math.max(yPos, 250);
    const lineWidth = 70;
    const lineX = (pageWidth - lineWidth) / 2;
    doc.line(lineX, yPos, lineX + lineWidth, yPos);
    doc.text("Assinatura da Diretoria", pageWidth / 2, yPos + 5, { align: "center" });

    doc.setFontSize(8);
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      285,
      { align: "center" }
    );

    doc.save(`boletim_${boletim.alunoNome.replace(/\s+/g, "_")}_${boletim.anoLetivo}.pdf`);
  };

  const generateBoletimPdfBase64 = (boletim: Boletim): string => {
    const pdfDoc = new jsPDF();
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    pdfDoc.setFontSize(16);
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text("BOLETIM ESCOLAR", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    pdfDoc.setFontSize(12);
    pdfDoc.text(boletim.escola || "Preparatório Vestibulando", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    pdfDoc.setFontSize(10);
    pdfDoc.setFont("helvetica", "normal");
    
    pdfDoc.text(`Aluno: ${boletim.alunoNome}`, margin, yPos);
    pdfDoc.text(`Matrícula: ${boletim.alunoMatricula || "-"}`, pageWidth - margin - 50, yPos);
    yPos += 6;
    
    pdfDoc.text(`Turma: ${boletim.turmaNome}`, margin, yPos);
    pdfDoc.text(`Ano Letivo: ${boletim.anoLetivo}`, pageWidth - margin - 50, yPos);
    yPos += 10;

    const periodosList = boletim.periodos || (boletim.periodoTipo === "bimestre" ? PERIODOS_BIMESTRE : PERIODOS_TRIMESTRE);
    
    const tableHead = [["Matéria", ...periodosList, "Média Final", "Média Mínima Esperada"]];
    const tableBody = boletim.materias.map(m => [
      m.materia,
      ...periodosList.map(p => formatNota(m.notas[p])),
      formatNota(m.mediaFinal),
      formatNota(m.mediaEsperada || 7),
    ]);

    autoTable(pdfDoc, {
      startY: yPos,
      head: tableHead,
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    yPos = (pdfDoc as any).lastAutoTable.finalY + 10;

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.text(`Média Final Anual: ${formatNota(boletim.mediaGeral)}`, margin, yPos);
    pdfDoc.text(`Situação: ${boletim.situacao.toUpperCase()}`, pageWidth - margin - 50, yPos);
    yPos += 8;

    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.text(`Presenças: ${boletim.presencas}`, margin, yPos);
    pdfDoc.text(`Faltas: ${boletim.faltas}`, margin + 50, yPos);
    pdfDoc.text(`Frequência: ${boletim.percentualPresenca !== null && boletim.percentualPresenca !== undefined ? boletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}`, margin + 100, yPos);
    yPos += 10;

    if (boletim.observacoes) {
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("Observações:", margin, yPos);
      yPos += 5;
      pdfDoc.setFont("helvetica", "normal");
      const obsLines = pdfDoc.splitTextToSize(boletim.observacoes, pageWidth - 2 * margin);
      pdfDoc.text(obsLines, margin, yPos);
      yPos += obsLines.length * 5 + 10;
    }

    yPos = Math.max(yPos, 250);
    const lineWidth = 70;
    const lineX = (pageWidth - lineWidth) / 2;
    pdfDoc.line(lineX, yPos, lineX + lineWidth, yPos);
    pdfDoc.text("Assinatura da Diretoria", pageWidth / 2, yPos + 5, { align: "center" });

    pdfDoc.setFontSize(8);
    pdfDoc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      285,
      { align: "center" }
    );

    return pdfDoc.output("datauristring");
  };

  const saveBoletimDocumento = async (boletim: Boletim, pdfBase64: string) => {
    if (!userData) return;
    
    const existingDocsQuery = query(
      collection(db, "boletimDocumentos"),
      where("boletimId", "==", boletim.id)
    );
    const existingDocs = await getDocs(existingDocsQuery);
    
    if (!existingDocs.empty) {
      const existingDoc = existingDocs.docs[0];
      const currentData = existingDoc.data();
      await updateDoc(doc(db, "boletimDocumentos", existingDoc.id), {
        pdfBase64,
        situacao: boletim.situacao,
        mediaGeral: boletim.mediaGeral,
        versao: (currentData.versao || 1) + 1,
        atualizadoPor: userData.uid,
        atualizadoPorNome: userData.nome,
        dataAtualizacao: getNowBrasiliaISO(),
      });
    } else {
      await addDoc(collection(db, "boletimDocumentos"), {
        boletimId: boletim.id,
        alunoId: boletim.alunoId,
        alunoNome: boletim.alunoNome,
        alunoMatricula: boletim.alunoMatricula,
        turmaId: boletim.turmaId,
        turmaNome: boletim.turmaNome,
        anoLetivo: boletim.anoLetivo,
        pdfBase64,
        situacao: boletim.situacao,
        mediaGeral: boletim.mediaGeral,
        versao: 1,
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: getNowBrasiliaISO(),
      });
    }
  };

  const removeBoletimDocumento = async (boletimId: string) => {
    const existingDocsQuery = query(
      collection(db, "boletimDocumentos"),
      where("boletimId", "==", boletimId)
    );
    const existingDocs = await getDocs(existingDocsQuery);
    
    for (const docSnapshot of existingDocs.docs) {
      await deleteDoc(doc(db, "boletimDocumentos", docSnapshot.id));
    }
  };

  const alunosDaTurma = useMemo(() => {
    if (!selectedTurmaId || !alunos) return [];
    return alunos
      .filter(a => a.turma === selectedTurmaId)
      .sort((a, b) => a.nome.localeCompare(b.nome)); // Ordenação alfabética
  }, [selectedTurmaId, alunos]);

  const stats = useMemo(() => ({
    total: boletins?.length || 0,
    liberados: boletins?.filter(b => b.liberado).length || 0,
    aprovados: boletins?.filter(b => b.situacao === "aprovado").length || 0,
    reprovados: boletins?.filter(b => b.situacao === "reprovado").length || 0,
    cursando: boletins?.filter(b => b.situacao === "cursando").length || 0,
  }), [boletins]);

  const renderBoletimForm = () => (
    <div className="overflow-y-auto max-h-[60vh] pr-2">
      <div className="space-y-6">
        {!selectedBoletim && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select value={selectedTurmaId} onValueChange={setSelectedTurmaId}>
                <SelectTrigger data-testid="select-turma-boletim">
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas?.filter(t => t.ativa).map(turma => (
                    <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Aluno</Label>
              <Select 
                value={selectedAlunoId} 
                onValueChange={(id) => {
                  setSelectedAlunoId(id);
                  if (id && id !== "todos" && notasBimestre) {
                    carregarNotasProfessores(id);
                  }
                  if (id === "todos") {
                    if (currentBimestre) {
                      setSelectedBimestreNumero(currentBimestre.numero);
                    }
                    setBulkDialogOpen(true);
                    setCreateDialogOpen(false);
                  }
                }} 
                disabled={!selectedTurmaId}
              >
                <SelectTrigger data-testid="select-aluno-boletim">
                  <SelectValue placeholder={selectedTurmaId ? "Selecione o aluno" : "Selecione a turma primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="font-semibold text-primary">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todos os Alunos ({alunosDaTurma.length})
                    </div>
                  </SelectItem>
                  <div className="h-px bg-border my-1" />
                  {alunosDaTurma.map(aluno => {
                    const notasCount = countNotasDisponiveis(aluno.uid);
                    return (
                      <SelectItem key={aluno.uid} value={aluno.uid}>
                        {aluno.nome}
                        {notasCount > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {notasCount} notas
                          </Badge>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedAlunoId && selectedAlunoId !== "todos" && countNotasDisponiveis(selectedAlunoId) > 0 && (
                <p className="text-xs text-green-600">
                  {countNotasDisponiveis(selectedAlunoId)} notas de professores carregadas automaticamente
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Ano Letivo</Label>
              <Input 
                value={anoLetivo} 
                onChange={(e) => setAnoLetivo(e.target.value)}
                placeholder="2025"
                data-testid="input-ano-letivo"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Período</Label>
              <Select value={periodoTipo} onValueChange={(v: "bimestre" | "trimestre") => {
                setPeriodoTipo(v);
                initializeMateriasNotas();
              }}>
                <SelectTrigger data-testid="select-periodo-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bimestre">Bimestral</SelectItem>
                  <SelectItem value="trimestre">Trimestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seletor de Bimestre */}
          {selectedAlunoId && selectedTurmaId && (
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Selecione o Bimestre</Label>
                {currentBimestre && (
                  <Badge variant="default" className="bg-green-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Bimestre Atual: {currentBimestre.numero}º
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((bim) => {
                  const jaExiste = !bimestresDisponiveis.includes(bim);
                  const isSelected = selectedBimestreNumero === bim;
                  const bimestreStatus = getBimestreStatus(bim);
                  const podeEmitir = canEmitBoletim(bim, userData?.tipo);
                  const isCurrentBim = currentBimestre?.numero === bim;
                  
                  const isDisabled = jaExiste || !podeEmitir;
                  
                  let statusIcon = null;
                  let statusText = "";
                  
                  if (bimestreStatus.status === "aguardando") {
                    statusIcon = <Clock className="h-3 w-3 ml-1" />;
                    statusText = "Aguardando";
                  } else if (bimestreStatus.status === "fechado") {
                    statusIcon = <Lock className="h-3 w-3 ml-1" />;
                    statusText = "Encerrado";
                  } else if (bimestreStatus.status === "nao_configurado") {
                    statusIcon = <AlertCircle className="h-3 w-3 ml-1" />;
                    statusText = "Não configurado";
                  } else if (jaExiste) {
                    statusIcon = <Lock className="h-3 w-3 ml-1" />;
                    statusText = "Já emitido";
                  }
                  
                  return (
                    <Button
                      key={bim}
                      variant={isSelected ? "default" : isDisabled ? "secondary" : "outline"}
                      className={`${isDisabled ? "opacity-50 cursor-not-allowed" : ""} ${isCurrentBim && !jaExiste ? "ring-2 ring-green-500" : ""}`}
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedBimestreNumero(bim);
                        const notasAnteriores = carregarNotasBimestresAnteriores(bim);
                        setMateriasNotas(notasAnteriores);
                        toast({
                          title: `${bim}º Bimestre selecionado`,
                          description: bim > 1 ? "Notas dos bimestres anteriores carregadas automaticamente" : "Primeiro bimestre do ano",
                        });
                      }}
                      data-testid={`button-bimestre-${bim}`}
                    >
                      {bim}º Bimestre
                      {statusIcon}
                    </Button>
                  );
                })}
              </div>
              {getBoletinsExistentes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Este aluno já possui boletim para: {getBoletinsExistentes.map(b => `${b.bimestreNumero || 1}º Bimestre`).join(", ")}
                </p>
              )}
              {!currentBimestre && (
                <p className="text-xs text-amber-600">
                  Nenhum bimestre está em andamento no momento. Configure os bimestres na aba de Bimestres.
                </p>
              )}
              {currentBimestre && (
                <p className="text-xs text-green-600">
                  Somente o {currentBimestre.numero}º Bimestre pode ser emitido ou editado neste momento.
                </p>
              )}
            </div>
          )}
          </>
        )}

        {/* Seletor de Bimestre para edição quando já existe boletim */}
        {selectedBoletim && (
          <div className="p-4 bg-muted rounded-lg">
            <Label className="font-semibold">Bimestre: {selectedBimestreNumero}º Bimestre</Label>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">Notas por Matéria</Label>
            {selectedAlunoId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => carregarNotasProfessores(selectedAlunoId)}
                data-testid="button-recarregar-notas"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar Notas dos Professores
              </Button>
            )}
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Matéria</TableHead>
                  {periodos.map(p => (
                    <TableHead key={p} className="text-center w-24">{p}</TableHead>
                  ))}
                  <TableHead className="text-center w-24">Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiasNotas.map((materia, idx) => (
                  <TableRow key={materia.materia}>
                    <TableCell className="font-medium">{materia.materia}</TableCell>
                    {periodos.map(p => (
                      <TableCell key={p} className="p-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="w-full text-center h-8"
                          placeholder="0,0"
                          value={getNotaBoletimDisplayValue(idx, p, materia.notas[p])}
                          onChange={(e) => handleNotaChange(idx, p, e.target.value)}
                          data-testid={`input-nota-${idx}-${p}`}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold">
                      {formatNota(materia.mediaFinal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Presenças</Label>
            <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium" data-testid="display-presencas">
              {frequenciaDoAluno.presencas}
            </div>
            <p className="text-xs text-muted-foreground">Calculado automaticamente</p>
          </div>
          <div className="space-y-2">
            <Label>Faltas</Label>
            <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium" data-testid="display-faltas">
              {frequenciaDoAluno.faltas}
            </div>
            <p className="text-xs text-muted-foreground">Calculado automaticamente</p>
          </div>
          <div className="space-y-2">
            <Label>Frequência</Label>
            <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium" data-testid="display-frequencia">
              {(frequenciaDoAluno.presencas + frequenciaDoAluno.faltas) > 0 
                ? ((frequenciaDoAluno.presencas / (frequenciaDoAluno.presencas + frequenciaDoAluno.faltas)) * 100).toFixed(1).replace(".", ",") + "%" 
                : "-"}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Situação</Label>
            <Select value={situacao} onValueChange={(v: "cursando" | "aprovado" | "reprovado") => setSituacao(v)}>
              <SelectTrigger data-testid="select-situacao">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cursando">Cursando</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea 
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações sobre o desempenho do aluno..."
            rows={3}
            data-testid="input-observacoes"
          />
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Média Anual</p>
              <p className="text-2xl font-bold">
                {formatNota(calcularMediaGeral(materiasNotas))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Boletins Escolares
          </h2>
          <p className="text-muted-foreground">Gerencie os boletins dos alunos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshAllBoletinsNotas}
            disabled={bulkCreating}
            data-testid="button-refresh-all-notas"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${bulkCreating ? "animate-spin" : ""}`} />
            Recarregar Notas dos Professores
          </Button>
          <Button onClick={openCreateDialog} data-testid="button-create-boletim">
            <Plus className="h-4 w-4 mr-2" />
            Emitir Boletim Escolar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liberados</CardTitle>
            <Unlock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.liberados}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.aprovados}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reprovados</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.reprovados}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cursando</CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.cursando}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno ou turma..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-boletim"
            />
          </div>
        </div>
        <Select value={filterTurma} onValueChange={setFilterTurma}>
          <SelectTrigger className="w-[180px]" data-testid="filter-turma">
            <SelectValue placeholder="Filtrar por turma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as turmas</SelectItem>
            {turmas?.filter(t => t.ativa).map(turma => (
              <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="w-[180px]" data-testid="filter-situacao">
            <SelectValue placeholder="Filtrar por situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="cursando">Cursando</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="reprovado">Reprovado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBimestre} onValueChange={setFilterBimestre}>
          <SelectTrigger className="w-[180px]" data-testid="filter-bimestre">
            <SelectValue placeholder="Filtrar por bimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os bimestres</SelectItem>
            <SelectItem value="1">1º Bimestre</SelectItem>
            <SelectItem value="2">2º Bimestre</SelectItem>
            <SelectItem value="3">3º Bimestre</SelectItem>
            <SelectItem value="4">4º Bimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadingBoletins ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filteredBoletins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum boletim encontrado</p>
            <p className="text-sm text-muted-foreground">Crie um novo boletim para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBoletins.map(boletim => (
            <Card key={boletim.id} className="hover-elevate" data-testid={`card-boletim-${boletim.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{boletim.alunoNome}</CardTitle>
                      <CardDescription>
                        {boletim.turmaNome} | Ano: {boletim.anoLetivo}
                        {boletim.alunoMatricula && ` | Matrícula: ${boletim.alunoMatricula}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 border-primary text-primary">
                      {boletim.bimestreNumero || 1}º Bimestre
                    </Badge>
                    <Badge variant={boletim.liberado ? "default" : "secondary"}>
                      {boletim.liberado ? "Liberado" : "Não liberado"}
                    </Badge>
                    <Badge variant={
                      boletim.situacao === "aprovado" ? "default" :
                      boletim.situacao === "reprovado" ? "destructive" : "secondary"
                    }>
                      {boletim.situacao.charAt(0).toUpperCase() + boletim.situacao.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Média Anual:</span>{" "}
                    <span className="font-bold text-foreground">{formatNota(boletim.mediaGeral)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Frequência:</span>{" "}
                    <span className="font-bold text-foreground">{boletim.percentualPresenca !== null && boletim.percentualPresenca !== undefined ? boletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}</span>
                  </div>
                  <div>
                    <span className="font-medium">Presenças/Faltas:</span>{" "}
                    <span className="font-bold text-foreground">{boletim.presencas}/{boletim.faltas}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                {(() => {
                  const bimNum = boletim.bimestreNumero || 1;
                  const podeEditar = canEditBimestre(bimNum, userData?.tipo);
                  const bimestreStatus = getBimestreStatus(bimNum);
                  
                  return (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedBoletim(boletim); setViewDialogOpen(true); }}>
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openEditDialog(boletim)}
                        disabled={!podeEditar}
                        title={!podeEditar ? `${bimNum}º Bimestre está ${bimestreStatus.statusLabel}` : "Editar boletim"}
                      >
                        {!podeEditar ? <Lock className="h-4 w-4 mr-1" /> : <Edit className="h-4 w-4 mr-1" />}
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePrintBoletim(boletim)}>
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimir
                      </Button>
                      <Button 
                        variant={boletim.liberado ? "secondary" : "default"} 
                        size="sm"
                        onClick={() => toggleReleaseMutation.mutate({ boletimId: boletim.id, liberar: !boletim.liberado, boletim })}
                        disabled={toggleReleaseMutation.isPending || !podeEditar}
                        title={!podeEditar ? `${bimNum}º Bimestre está ${bimestreStatus.statusLabel}` : ""}
                      >
                        {boletim.liberado ? <Lock className="h-4 w-4 mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
                        {boletim.liberado ? "Bloquear" : "Liberar"}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive"
                        disabled={!podeEditar}
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir este boletim?")) {
                            deleteMutation.mutate({ boletimId: boletim.id, boletim });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </>
                  );
                })()}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Emissão/Edição de Boletim */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          setEditingBoletimData(null);
        }
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingBoletimData ? "Editar/Ver Boletim" : "Emitir Boletim Escolar"}
            </DialogTitle>
            <DialogDescription>
              {editingBoletimData 
                ? `${editingBoletimData.alunoNome} - ${editingBoletimData.turmaNome}` 
                : "Crie um novo boletim escolar para um aluno"
              }
            </DialogDescription>
          </DialogHeader>
          {renderBoletimForm()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setEditingBoletimData(null);
            }}>
              Cancelar
            </Button>
            {editingBoletimData ? (
              <Button 
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                data-testid="button-save-boletim"
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            ) : (
              <Button 
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !selectedAlunoId}
                data-testid="button-save-boletim"
              >
                {createMutation.isPending ? "Salvando..." : "Emitir Boletim"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Boletim</DialogTitle>
            <DialogDescription>
              {selectedBoletim && `${selectedBoletim.alunoNome} - ${selectedBoletim.turmaNome}`}
            </DialogDescription>
          </DialogHeader>
          {renderBoletimForm()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-update-boletim"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Boletim Escolar
              {selectedBoletim && (
                <Badge variant="outline" className="bg-primary/10 border-primary text-primary">
                  {selectedBoletim.bimestreNumero || 1}º Bimestre
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedBoletim && `${selectedBoletim.alunoNome} - ${selectedBoletim.turmaNome} - ${selectedBoletim.anoLetivo}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBoletim && (
            <div className="overflow-y-auto max-h-[60vh] pr-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Aluno</p>
                    <p className="font-medium">{selectedBoletim.alunoNome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matrícula</p>
                    <p className="font-medium">{selectedBoletim.alunoMatricula || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Turma</p>
                    <p className="font-medium">{selectedBoletim.turmaNome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Situação</p>
                    <Badge variant={
                      selectedBoletim.situacao === "aprovado" ? "default" :
                      selectedBoletim.situacao === "reprovado" ? "destructive" : "secondary"
                    }>
                      {selectedBoletim.situacao.charAt(0).toUpperCase() + selectedBoletim.situacao.slice(1)}
                    </Badge>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matéria</TableHead>
                        {(selectedBoletim.periodos || PERIODOS_BIMESTRE).map(p => (
                          <TableHead key={p} className="text-center">{p}</TableHead>
                        ))}
                        <TableHead className="text-center">Média</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBoletim.materias.map(m => (
                        <TableRow key={m.materia}>
                          <TableCell className="font-medium">{m.materia}</TableCell>
                          {(selectedBoletim.periodos || PERIODOS_BIMESTRE).map(p => (
                            <TableCell key={p} className="text-center">
                              {formatNota(m.notas[p])}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold">
                            {formatNota(m.mediaFinal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Média Anual</p>
                    <p className="text-2xl font-bold">{formatNota(selectedBoletim.mediaGeral)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Presenças/Faltas</p>
                    <p className="text-2xl font-bold">{selectedBoletim.presencas}/{selectedBoletim.faltas}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Frequência</p>
                    <p className="text-2xl font-bold">{selectedBoletim.percentualPresenca !== null && selectedBoletim.percentualPresenca !== undefined ? selectedBoletim.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}</p>
                  </div>
                </div>

                {selectedBoletim.observacoes && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{selectedBoletim.observacoes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => selectedBoletim && handlePrintBoletim(selectedBoletim)}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criação em Lote */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
        if (!bulkCreating) {
          setBulkDialogOpen(open);
          if (!open) {
            setSelectedAlunoId("");
            setEditingBoletimId(null);
            setExpandedAlunos(new Set());
            setSelectedForPrint(new Set());
          }
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Boletins em Lote - Todos os Alunos
            </DialogTitle>
            <DialogDescription>
              Gerencie, edite e imprima boletins para todos os alunos da turma
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto max-h-[65vh]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Turma</Label>
                <Select value={selectedTurmaId} onValueChange={(v) => {
                  setSelectedTurmaId(v);
                  setExpandedAlunos(new Set());
                  setSelectedForPrint(new Set());
                }}>
                  <SelectTrigger data-testid="select-turma-bulk">
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas?.filter(t => t.ativa).map(turma => (
                      <SelectItem key={turma.id} value={turma.id}>{turma.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Ano Letivo</Label>
                <Input 
                  value={anoLetivo} 
                  onChange={(e) => setAnoLetivo(e.target.value)}
                  placeholder="2025"
                  data-testid="input-ano-letivo-bulk"
                />
              </div>

              <div className="space-y-2">
                <Label>Bimestre (para visualização)</Label>
                <Select value={periodoTipo} onValueChange={(v: "bimestre" | "trimestre") => setPeriodoTipo(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bimestre">Bimestral</SelectItem>
                    <SelectItem value="trimestre">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seletor de Bimestre para criação em lote - apenas bimestre vigente */}
            {selectedTurmaId && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="font-semibold">Selecione o Bimestre para Criação em Lote</Label>
                  {currentBimestre && (
                    <Badge variant="default" className="bg-green-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Bimestre Vigente: {currentBimestre.numero}º
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((bim) => {
                    const isSelected = selectedBimestreNumero === bim;
                    const isCurrentBim = currentBimestre?.numero === bim;
                    const podeEmitir = canEmitBoletim(bim, userData?.tipo);
                    const isDisabled = !podeEmitir;
                    return (
                      <Button
                        key={bim}
                        variant={isSelected ? "default" : isDisabled ? "secondary" : "outline"}
                        className={`${isDisabled ? "opacity-50 cursor-not-allowed" : ""} ${isCurrentBim && podeEmitir ? "ring-2 ring-green-500" : ""}`}
                        disabled={isDisabled}
                        onClick={() => {
                          if (podeEmitir) {
                            setSelectedBimestreNumero(bim);
                          }
                        }}
                        data-testid={`button-bulk-bimestre-${bim}`}
                      >
                        {bim}º Bimestre
                      </Button>
                    );
                  })}
                </div>
                {currentBimestre ? (
                  <p className="text-xs text-green-600">
                    Somente o {currentBimestre.numero}º Bimestre pode ser usado para criação em lote. Boletins serão criados apenas para alunos que ainda não possuem boletim neste bimestre.
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">
                    Nenhum bimestre está em andamento no momento. Configure os bimestres na aba de Bimestres.
                  </p>
                )}
              </div>
            )}

            {selectedTurmaId && (
              <>
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-semibold">Resumo da Turma: {turmas?.find(t => t.id === selectedTurmaId)?.nome}</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshAllNotasFromProfessores}
                      disabled={bulkCreating}
                      data-testid="button-refresh-notas"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar Notas dos Professores
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total de Alunos</p>
                      <p className="text-xl font-bold">{alunosDaTurma.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Boletins {selectedBimestreNumero}º Bim</p>
                      <p className="text-xl font-bold text-green-600">
                        {boletins?.filter(b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo && (b.bimestreNumero || 1) === selectedBimestreNumero).length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sem {selectedBimestreNumero}º Bim</p>
                      <p className="text-xl font-bold text-amber-600">
                        {alunosDaTurma.filter(a => !boletins?.some(b => b.alunoId === a.uid && b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo && (b.bimestreNumero || 1) === selectedBimestreNumero)).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Liberados</p>
                      <p className="text-xl font-bold text-blue-600">
                        {boletins?.filter(b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo && (b.bimestreNumero || 1) === selectedBimestreNumero && b.liberado).length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Boletins</p>
                      <p className="text-xl font-bold text-purple-600">
                        {boletins?.filter(b => b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo).length || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {bulkCreating && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Processando...</span>
                      <span>{bulkProgress.current} de {bulkProgress.total}</span>
                    </div>
                    <Progress value={(bulkProgress.current / bulkProgress.total) * 100} />
                  </div>
                )}

                <div className="border rounded-lg">
                  <div className="p-3 bg-muted border-b flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={selectedForPrint.size === alunosDaTurma.length && alunosDaTurma.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <h4 className="font-semibold">Lista de Alunos</h4>
                      {selectedForPrint.size > 0 && (
                        <Badge variant="secondary">{selectedForPrint.size} selecionados</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrintSelected}
                        disabled={selectedForPrint.size === 0 || bulkCreating}
                        data-testid="button-print-selected"
                      >
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimir Selecionados ({selectedForPrint.size})
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="max-h-[40vh]">
                    <div className="divide-y">
                      {alunosDaTurma.map(aluno => {
                        const boletimAluno = boletins?.find(b => b.alunoId === aluno.uid && b.turmaId === selectedTurmaId && b.anoLetivo === anoLetivo);
                        const temBoletim = !!boletimAluno;
                        const notasCount = countNotasDisponiveis(aluno.uid);
                        const isExpanded = expandedAlunos.has(aluno.uid);
                        const isEditing = editingBoletimId === boletimAluno?.id;
                        const { complete, missingItems } = checkBoletimComplete(boletimAluno);
                        const freq = getFrequenciaAluno(aluno.uid);
                        
                        return (
                          <div key={aluno.uid} className="bg-background">
                            <div className="flex items-center gap-3 p-3 hover-elevate">
                              <Checkbox 
                                checked={selectedForPrint.has(aluno.uid)}
                                onCheckedChange={() => toggleSelectForPrint(aluno.uid)}
                                disabled={!temBoletim}
                                data-testid={`checkbox-aluno-${aluno.uid}`}
                              />
                              
                              <button 
                                onClick={() => temBoletim && toggleExpandAluno(aluno.uid)}
                                className="p-1 rounded hover-elevate"
                                disabled={!temBoletim}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <GraduationCap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium truncate">{aluno.nome}</span>
                                  {aluno.matricula && (
                                    <span className="text-xs text-muted-foreground">({aluno.matricula})</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                {notasCount > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {notasCount} notas prof.
                                  </Badge>
                                )}
                                
                                {temBoletim ? (
                                  <>
                                    {complete ? (
                                      <Badge variant="default" className="bg-green-600">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Completo
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-amber-600">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Incompleto
                                      </Badge>
                                    )}
                                    <Badge variant={boletimAluno?.liberado ? "default" : "secondary"}>
                                      {boletimAluno?.liberado ? "Liberado" : "Não liberado"}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      Média: {formatNota(boletimAluno?.mediaGeral)}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      Freq: {boletimAluno?.percentualPresenca !== null && boletimAluno?.percentualPresenca !== undefined ? Math.round(boletimAluno.percentualPresenca) + "%" : "-"}
                                    </Badge>
                                  </>
                                ) : (
                                  <Badge variant="destructive">
                                    Sem boletim
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {temBoletim ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setBulkDialogOpen(false);
                                        openEditDialog(boletimAluno!);
                                      }}
                                      title="Editar/Ver boletim"
                                      data-testid={`button-view-${aluno.uid}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handlePrintBoletim(boletimAluno!)}
                                      title="Imprimir boletim"
                                      data-testid={`button-print-${aluno.uid}`}
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => toggleReleaseMutation.mutate({ 
                                        boletimId: boletimAluno!.id, 
                                        liberar: !boletimAluno!.liberado,
                                        boletim: boletimAluno! 
                                      })}
                                      title={boletimAluno?.liberado ? "Bloquear boletim" : "Liberar boletim"}
                                      data-testid={`button-toggle-release-${aluno.uid}`}
                                    >
                                      {boletimAluno?.liberado ? (
                                        <Lock className="h-4 w-4" />
                                      ) : (
                                        <Unlock className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCreateSingleBoletim(aluno)}
                                    disabled={bulkCreating}
                                    data-testid={`button-create-${aluno.uid}`}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Criar Boletim
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {isExpanded && temBoletim && (
                              <div className="px-12 pb-4 space-y-4 bg-muted/30">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-4 text-sm">
                                    <span><strong>Presenças:</strong> {boletimAluno?.presencas || freq.presencas}</span>
                                    <span><strong>Faltas:</strong> {boletimAluno?.faltas || freq.faltas}</span>
                                    <span><strong>Frequência:</strong> {boletimAluno?.percentualPresenca !== null && boletimAluno?.percentualPresenca !== undefined ? boletimAluno.percentualPresenca.toFixed(1).replace(".", ",") + "%" : "-"}</span>
                                    <span><strong>Situação:</strong> {boletimAluno?.situacao}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setBulkDialogOpen(false);
                                        openEditDialog(boletimAluno!);
                                      }}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Editar/Ver Notas
                                    </Button>
                                  </div>
                                </div>
                                
                                {!complete && missingItems.length > 0 && (
                                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Itens pendentes:</p>
                                    <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
                                      {missingItems.slice(0, 5).map((item, i) => (
                                        <li key={i}>{item}</li>
                                      ))}
                                      {missingItems.length > 5 && <li>...e mais {missingItems.length - 5}</li>}
                                    </ul>
                                  </div>
                                )}
                                
                                <div className="border rounded-lg overflow-hidden bg-background">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-32">Matéria</TableHead>
                                        {(boletimAluno?.periodos || periodos).map(p => (
                                          <TableHead key={p} className="text-center w-20 text-xs">{p}</TableHead>
                                        ))}
                                        <TableHead className="text-center w-20">Média</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(isEditing ? bulkEditNotas[boletimAluno!.id] || boletimAluno?.materias : boletimAluno?.materias)?.map((m, idx) => (
                                        <TableRow key={m.materia}>
                                          <TableCell className="font-medium text-xs">{m.materia}</TableCell>
                                          {(boletimAluno?.periodos || periodos).map(p => (
                                            <TableCell key={p} className="p-1">
                                              {isEditing ? (
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  max="10"
                                                  step="0.1"
                                                  className="w-full text-center h-7 text-xs"
                                                  value={bulkEditNotas[boletimAluno!.id]?.[idx]?.notas[p] ?? ""}
                                                  onChange={(e) => handleBulkNotaChange(boletimAluno!.id, idx, p, e.target.value)}
                                                />
                                              ) : (
                                                <div className="text-center text-xs">
                                                  {formatNota(m.notas[p])}
                                                </div>
                                              )}
                                            </TableCell>
                                          ))}
                                          <TableCell className="text-center font-semibold text-xs">
                                            {isEditing 
                                              ? formatNota(bulkEditNotas[boletimAluno!.id]?.[idx]?.mediaFinal)
                                              : formatNota(m.mediaFinal)
                                            }
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2 border-t pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setBulkDialogOpen(false);
                setSelectedAlunoId("");
                setEditingBoletimId(null);
              }}
              disabled={bulkCreating}
            >
              Fechar
            </Button>
            
            <Button
              variant="outline"
              onClick={handlePrintAllBoletins}
              disabled={bulkCreating || !selectedTurmaId}
              data-testid="button-print-all"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Todos
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleBulkRelease(false)}
              disabled={bulkCreating || !selectedTurmaId}
              data-testid="button-block-all"
            >
              <Lock className="h-4 w-4 mr-2" />
              Bloquear Todos
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleBulkRelease(true)}
              disabled={bulkCreating || !selectedTurmaId}
              data-testid="button-release-all"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Liberar Todos
            </Button>

            <Button
              onClick={handleBulkCreate}
              disabled={bulkCreating || !selectedTurmaId || alunosDaTurma.length === 0}
              data-testid="button-create-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              {bulkCreating ? "Criando..." : "Criar Boletins para Todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
