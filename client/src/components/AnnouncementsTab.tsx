import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Megaphone, Image as ImageIcon, FileText, Eye, EyeOff, Calendar, Clock, Archive, Download, AlertCircle, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Announcement, Turma, AnnouncementSlide } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { getNowBrasiliaISO, formatBrasiliaDateTime, getNowBrasilia } from "@/lib/brasiliaTime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from "jspdf";
import "jspdf-autotable";

export function AnnouncementsTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  
  // Estados para diálogos
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [justifyDialogOpen, setJustifyDialogOpen] = useState(false);
  
  // Estados para o aviso selecionado
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  
  // Estados para formulário de aviso
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [slides, setSlides] = useState<AnnouncementSlide[]>([{ tipo: "texto", conteudo: "" }]);
  const [announcementTarget, setAnnouncementTarget] = useState<"todos" | "alunos" | "professores" | "turmas">("todos");
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  
  // Estados para agendamento
  const [tipoAviso, setTipoAviso] = useState<"instantaneo" | "programado">("instantaneo");
  const [tipoDuracao, setTipoDuracao] = useState<"determinada" | "indeterminada">("determinada");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  
  // Estado para justificativa
  const [justificativa, setJustificativa] = useState("");

  const { data: announcements, isLoading: loadingAnnouncements } = useRealtimeQuery<Announcement>({
    collectionName: "announcements",
    queryKey: ["/api/announcements"],
    transform: (docs) => docs as Announcement[],
  });

  const { data: turmas, isLoading: loadingTurmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["/api/turmas"],
    transform: (docs) => docs as Turma[],
  });

  // Filtrar avisos ativos, inativos e arquivados
  const activeAnnouncements = announcements?.filter(a => a.ativo && !a.arquivado) || [];
  const inactiveAnnouncements = announcements?.filter(a => !a.ativo && !a.arquivado) || [];
  const archivedAnnouncements = announcements?.filter(a => a.arquivado) || [];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, slideIndex: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione uma imagem válida",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const newSlides = [...slides];
        newSlides[slideIndex].conteudo = reader.result as string;
        setSlides(newSlides);
      };
      reader.readAsDataURL(file);
    }
  };

  const addSlide = () => {
    setSlides([...slides, { tipo: "texto", conteudo: "" }]);
  };

  const removeSlide = (index: number) => {
    if (slides.length > 1) {
      setSlides(slides.filter((_, i) => i !== index));
    }
  };

  const updateSlideType = (index: number, tipo: "texto" | "imagem") => {
    const newSlides = [...slides];
    newSlides[index] = { tipo, conteudo: "" };
    setSlides(newSlides);
  };

  const updateSlideContent = (index: number, conteudo: string) => {
    const newSlides = [...slides];
    newSlides[index].conteudo = conteudo;
    setSlides(newSlides);
  };

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      if (!userData) throw new Error("Usuário não autenticado");

      if (!announcementTitle.trim()) {
        throw new Error("O título do aviso é obrigatório");
      }

      // Validar slides
      const validSlides = slides.filter(s => s.conteudo.trim() !== "");
      if (validSlides.length === 0) {
        throw new Error("Adicione pelo menos um slide com conteúdo");
      }

      if (announcementTarget === "turmas" && selectedTurmas.length === 0) {
        throw new Error("Selecione pelo menos uma turma");
      }

      // Validar datas para avisos programados
      let dataInicio = getNowBrasiliaISO();
      let dataFim: string | undefined;

      if (tipoAviso === "programado") {
        if (!startDate || !startTime) {
          throw new Error("Data e hora de início são obrigatórias para avisos programados");
        }
        dataInicio = `${startDate}T${startTime}:00`;
      }

      if (tipoDuracao === "determinada") {
        if (!endDate || !endTime) {
          throw new Error("Data e hora de término são obrigatórias para avisos com duração determinada");
        }
        dataFim = `${endDate}T${endTime}:00`;
      }

      // Gerar número sequencial
      const allAnnouncementsQuery = query(collection(db, "announcements"));
      const allAnnouncementsDocs = await getDocs(allAnnouncementsQuery);
      
      let maxNumber = 0;
      allAnnouncementsDocs.docs.forEach(doc => {
        const data = doc.data();
        if (data.numeroAviso) {
          const num = parseInt(data.numeroAviso, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      });
      
      const nextNumber = maxNumber + 1;
      const numeroAviso = nextNumber.toString().padStart(4, '0');

      // Converter slides para objetos JavaScript simples (Firestore compatibility)
      const slidesData = validSlides.map(slide => 
        JSON.parse(JSON.stringify({
          tipo: slide.tipo,
          conteudo: slide.conteudo,
        }))
      );

      const announcementData: any = {
        numeroAviso,
        titulo: announcementTitle,
        slides: slidesData,
        publicoAlvo: announcementTarget,
        turmasSelecionadas: announcementTarget === "turmas" ? [...selectedTurmas] : [],
        tipoAviso,
        tipoDuracao,
        dataInicio,
        ativo: tipoAviso === "instantaneo",
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: getNowBrasiliaISO(),
        arquivado: false,
      };

      if (tipoAviso === "instantaneo") {
        announcementData.dataAtivacao = getNowBrasiliaISO();
      }

      if (dataFim) {
        announcementData.dataFim = dataFim;
      }

      await addDoc(collection(db, "announcements"), announcementData);
    },
    onSuccess: () => {
      toast({
        title: "Aviso criado!",
        description: tipoAviso === "instantaneo" 
          ? "O aviso foi criado e está ativo agora"
          : "O aviso foi agendado e será ativado automaticamente",
      });
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar aviso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAnnouncement) throw new Error("Nenhum aviso selecionado");
      if (!userData) throw new Error("Usuário não autenticado");

      if (!announcementTitle.trim()) {
        throw new Error("O título do aviso é obrigatório");
      }

      const validSlides = slides.filter(s => s.conteudo.trim() !== "");
      if (validSlides.length === 0) {
        throw new Error("Adicione pelo menos um slide com conteúdo");
      }

      if (announcementTarget === "turmas" && selectedTurmas.length === 0) {
        throw new Error("Selecione pelo menos uma turma");
      }

      let dataInicio = selectedAnnouncement.dataInicio;
      let dataFim: string | undefined = selectedAnnouncement.dataFim;

      if (tipoAviso === "programado") {
        if (!startDate || !startTime) {
          throw new Error("Data e hora de início são obrigatórias para avisos programados");
        }
        dataInicio = `${startDate}T${startTime}:00`;
      }

      if (tipoDuracao === "determinada") {
        if (!endDate || !endTime) {
          throw new Error("Data e hora de término são obrigatórias para avisos com duração determinada");
        }
        dataFim = `${endDate}T${endTime}:00`;
      } else {
        dataFim = undefined;
      }

      // Converter slides para objetos JavaScript simples (Firestore compatibility)
      const slidesData = validSlides.map(slide => 
        JSON.parse(JSON.stringify({
          tipo: slide.tipo,
          conteudo: slide.conteudo,
        }))
      );

      const updateData: any = {
        titulo: announcementTitle,
        slides: slidesData,
        publicoAlvo: announcementTarget,
        turmasSelecionadas: announcementTarget === "turmas" ? [...selectedTurmas] : [],
        tipoAviso,
        tipoDuracao,
        dataInicio,
        dataAtualizacao: getNowBrasiliaISO(),
      };

      if (dataFim) {
        updateData.dataFim = dataFim;
      } else {
        updateData.dataFim = null;
      }

      await updateDoc(doc(db, "announcements", selectedAnnouncement.id), updateData);
    },
    onSuccess: () => {
      toast({
        title: "Aviso atualizado!",
        description: "O aviso foi atualizado com sucesso",
      });
      setEditDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar aviso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateAnnouncementMutation = useMutation({
    mutationFn: async (announcement: Announcement) => {
      await updateDoc(doc(db, "announcements", announcement.id), {
        ativo: true,
        dataAtivacao: getNowBrasiliaISO(),
        dataAtualizacao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Aviso ativado!",
        description: "O aviso agora está visível para o público-alvo",
      });
      setActivateDialogOpen(false);
      setSelectedAnnouncement(null);
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao ativar aviso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deactivateAnnouncementMutation = useMutation({
    mutationFn: async (announcement: Announcement) => {
      await updateDoc(doc(db, "announcements", announcement.id), {
        ativo: false,
        dataDesativacao: getNowBrasiliaISO(),
        dataAtualizacao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Aviso desativado!",
        description: "O aviso não está mais visível para o público-alvo",
      });
      setDeactivateDialogOpen(false);
      setSelectedAnnouncement(null);
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desativar aviso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const announcementDoc = await getDocs(query(collection(db, "announcements")));
      const announcement = announcementDoc.docs.find(d => d.id === announcementId)?.data();
      
      if (announcement?.arquivado) {
        throw new Error("Não é possível deletar um aviso arquivado. O histórico de auditoria deve ser mantido permanentemente.");
      }

      await deleteDoc(doc(db, "announcements", announcementId));
    },
    onSuccess: () => {
      toast({
        title: "Aviso excluído!",
        description: "O aviso foi excluído com sucesso",
      });
      setDeleteDialogOpen(false);
      setSelectedAnnouncement(null);
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir aviso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveAnnouncementMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAnnouncement) throw new Error("Nenhum aviso selecionado");
      if (!justificativa.trim()) throw new Error("Justificativa é obrigatória para arquivar");
      if (!userData) throw new Error("Usuário não autenticado");

      await updateDoc(doc(db, "announcements", selectedAnnouncement.id), {
        arquivado: true,
        ativo: false,
        justificativa: justificativa,
        justificadoPor: userData.uid,
        justificadoPorNome: userData.nome,
        dataJustificativa: getNowBrasiliaISO(),
        dataAtualizacao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Aviso arquivado!",
        description: "O aviso foi arquivado no histórico de auditoria",
      });
      setArchiveDialogOpen(false);
      setJustificativa("");
      setSelectedAnnouncement(null);
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao arquivar aviso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addJustificationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAnnouncement) throw new Error("Nenhum aviso selecionado");
      if (!justificativa.trim()) throw new Error("Justificativa é obrigatória");
      if (!userData) throw new Error("Usuário não autenticado");

      await updateDoc(doc(db, "announcements", selectedAnnouncement.id), {
        justificativa: justificativa,
        justificadoPor: userData.uid,
        justificadoPorNome: userData.nome,
        dataJustificativa: getNowBrasiliaISO(),
        dataAtualizacao: getNowBrasiliaISO(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Justificativa adicionada!",
        description: "A justificativa foi salva com sucesso",
      });
      setJustifyDialogOpen(false);
      setJustificativa("");
      setSelectedAnnouncement(null);
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar justificativa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadAuditHistory = async () => {
    if (!archivedAnnouncements || archivedAnnouncements.length === 0) {
      toast({
        title: "Histórico vazio",
        description: "Não há avisos arquivados no histórico de auditoria",
        variant: "destructive",
      });
      return;
    }

    const pdf = new jsPDF();
    
    pdf.setFontSize(16);
    pdf.text("HISTÓRICO DE AUDITORIA - AVISOS", 105, 15, { align: "center" });
    
    pdf.setFontSize(10);
    pdf.text(`Gerado em: ${formatBrasiliaDateTime(getNowBrasiliaISO())}`, 105, 22, { align: "center" });
    
    const tableData = archivedAnnouncements.map(announcement => [
      announcement.numeroAviso,
      announcement.titulo,
      announcement.publicoAlvo === "todos" ? "Todos" : 
        announcement.publicoAlvo === "alunos" ? "Alunos" :
        announcement.publicoAlvo === "professores" ? "Professores" : "Turmas",
      formatBrasiliaDateTime(announcement.dataCriacao),
      announcement.criadoPorNome,
      announcement.justificativa || "N/A",
    ]);

    (pdf as any).autoTable({
      head: [["Nº", "Título", "Público", "Data Criação", "Criado Por", "Justificativa"]],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 66, 66] },
    });

    pdf.save(`Historico_Auditoria_Avisos_${new Date().getTime()}.pdf`);
    
    toast({
      title: "Download iniciado!",
      description: "O histórico de auditoria está sendo baixado",
    });
  };

  const resetForm = () => {
    setAnnouncementTitle("");
    setSlides([{ tipo: "texto", conteudo: "" }]);
    setAnnouncementTarget("todos");
    setSelectedTurmas([]);
    setTipoAviso("instantaneo");
    setTipoDuracao("determinada");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setSelectedAnnouncement(null);
  };

  const openEditDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementTitle(announcement.titulo);
    setSlides(announcement.slides);
    setAnnouncementTarget(announcement.publicoAlvo);
    setSelectedTurmas(announcement.turmasSelecionadas || []);
    setTipoAviso(announcement.tipoAviso);
    setTipoDuracao(announcement.tipoDuracao);
    
    if (announcement.dataInicio) {
      const [date, time] = announcement.dataInicio.split('T');
      setStartDate(date);
      setStartTime(time?.substring(0, 5) || "");
    }
    
    if (announcement.dataFim) {
      const [date, time] = announcement.dataFim.split('T');
      setEndDate(date);
      setEndTime(time?.substring(0, 5) || "");
    }
    
    setEditDialogOpen(true);
  };

  const handleTurmaToggle = (turmaId: string) => {
    setSelectedTurmas(prev =>
      prev.includes(turmaId)
        ? prev.filter(id => id !== turmaId)
        : [...prev, turmaId]
    );
  };

  const renderAnnouncementCard = (announcement: Announcement, isArchived: boolean = false) => (
    <Card key={announcement.id} className="hover-elevate">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                #{announcement.numeroAviso} - {announcement.titulo}
              </CardTitle>
              <CardDescription>
                {announcement.slides.length} slide(s) • Criado em {new Date(announcement.dataCriacao).toLocaleDateString('pt-BR')}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isArchived && <Badge variant="secondary">Arquivado</Badge>}
            {!isArchived && (
              <Badge variant={announcement.ativo ? "default" : "secondary"}>
                {announcement.ativo ? "Ativo" : "Inativo"}
              </Badge>
            )}
            <Badge variant="outline">
              {announcement.publicoAlvo === "todos" ? "Todos" :
               announcement.publicoAlvo === "alunos" ? "Alunos" :
               announcement.publicoAlvo === "professores" ? "Professores" :
               `${announcement.turmasSelecionadas?.length || 0} turma(s)`}
            </Badge>
            <Badge variant="outline">
              {announcement.tipoAviso === "instantaneo" ? "Instantâneo" : "Programado"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p><strong>Criado por:</strong> {announcement.criadoPorNome}</p>
          {announcement.tipoAviso === "programado" && (
            <p><strong>Início programado:</strong> {formatBrasiliaDateTime(announcement.dataInicio)}</p>
          )}
          {announcement.dataFim && (
            <p><strong>Fim programado:</strong> {formatBrasiliaDateTime(announcement.dataFim)}</p>
          )}
          {announcement.dataAtivacao && (
            <p><strong>Ativado em:</strong> {formatBrasiliaDateTime(announcement.dataAtivacao)}</p>
          )}
          {isArchived && announcement.justificativa && (
            <p><strong>Justificativa:</strong> {announcement.justificativa}</p>
          )}
        </div>

        {!isArchived && (
          <div className="flex flex-wrap gap-2">
            {announcement.ativo ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAnnouncement(announcement);
                  setDeactivateDialogOpen(true);
                }}
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Desativar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAnnouncement(announcement);
                  setActivateDialogOpen(true);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ativar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditDialog(announcement)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedAnnouncement(announcement);
                setArchiveDialogOpen(true);
              }}
            >
              <Archive className="h-4 w-4 mr-2" />
              Arquivar
            </Button>
            {!announcement.justificativa && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAnnouncement(announcement);
                  setJustifyDialogOpen(true);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Adicionar Justificativa
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedAnnouncement(announcement);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Quadro de Avisos</h3>
        <Button onClick={() => {
          resetForm();
          const now = getNowBrasilia();
          setStartDate(now.dateString);
          setStartTime(now.timeString);
          setCreateDialogOpen(true);
        }} data-testid="button-create-announcement">
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      {loadingAnnouncements ? (
        <>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" data-testid="tab-active">
              Ativos ({activeAnnouncements.length})
            </TabsTrigger>
            <TabsTrigger value="inactive" data-testid="tab-inactive">
              Inativos ({inactiveAnnouncements.length})
            </TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-archived">
              Arquivados ({archivedAnnouncements.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeAnnouncements.length > 0 ? (
              <div className="grid gap-4">
                {activeAnnouncements
                  .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
                  .map((announcement) => renderAnnouncementCard(announcement))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Megaphone className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhum aviso ativo</p>
                  <p className="text-sm text-muted-foreground">Crie um aviso para começar</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="inactive" className="space-y-4">
            {inactiveAnnouncements.length > 0 ? (
              <div className="grid gap-4">
                {inactiveAnnouncements
                  .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
                  .map((announcement) => renderAnnouncementCard(announcement))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhum aviso inativo</p>
                  <p className="text-sm text-muted-foreground">Avisos desativados aparecerão aqui</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="archived" className="space-y-4">
            {archivedAnnouncements.length > 0 ? (
              <>
                <div className="flex justify-end">
                  <Button onClick={downloadAuditHistory} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Histórico (PDF)
                  </Button>
                </div>
                <div className="grid gap-4">
                  {archivedAnnouncements
                    .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
                    .map((announcement) => renderAnnouncementCard(announcement, true))}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Archive className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Nenhum aviso arquivado</p>
                  <p className="text-sm text-muted-foreground">Avisos arquivados aparecerão no histórico de auditoria</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog: Criar Aviso */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-announcement">
          <DialogHeader>
            <DialogTitle>Criar Novo Aviso</DialogTitle>
            <DialogDescription>
              Configure o título, slides, público-alvo e agendamento do aviso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título do Aviso *</Label>
              <Input
                id="title"
                placeholder="Ex: Aviso Importante - Mudança de Horário"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                data-testid="input-announcement-title"
              />
            </div>

            {/* Slides */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Slides do Aviso *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSlide}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Slide
                </Button>
              </div>
              
              {slides.map((slide, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>Slide {index + 1}</Label>
                      {slides.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlide(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <Select
                      value={slide.tipo}
                      onValueChange={(value: "texto" | "imagem") => updateSlideType(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="texto">Texto</SelectItem>
                        <SelectItem value="imagem">Imagem</SelectItem>
                      </SelectContent>
                    </Select>

                    {slide.tipo === "texto" ? (
                      <Textarea
                        placeholder="Digite o texto do slide..."
                        value={slide.conteudo}
                        onChange={(e) => updateSlideContent(index, e.target.value)}
                        rows={4}
                      />
                    ) : (
                      <>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, index)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Sugestão: Use imagens com proporção 16:9 (ex: 1280x720, 1920x1080) para melhor visualização
                        </p>
                        {slide.conteudo && (
                          <div className="mt-2 flex justify-center">
                            <img
                              src={slide.conteudo}
                              alt={`Preview slide ${index + 1}`}
                              className="max-w-full h-auto max-h-48 rounded-lg border"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Público-Alvo */}
            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Select value={announcementTarget} onValueChange={(value: "todos" | "alunos" | "professores" | "turmas") => {
                setAnnouncementTarget(value);
                setSelectedTurmas([]);
              }}>
                <SelectTrigger data-testid="select-announcement-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos (Alunos e Professores)</SelectItem>
                  <SelectItem value="alunos">Todos os Alunos</SelectItem>
                  <SelectItem value="professores">Todos os Professores</SelectItem>
                  <SelectItem value="turmas">Turmas Específicas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {announcementTarget === "turmas" && (
              <div className="space-y-2">
                <Label>Selecione as Turmas *</Label>
                <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                  {loadingTurmas ? (
                    <p className="text-sm text-muted-foreground">Carregando turmas...</p>
                  ) : turmas && turmas.length > 0 ? (
                    turmas.map((turma) => (
                      <div key={turma.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`turma-${turma.id}`}
                          checked={selectedTurmas.includes(turma.id)}
                          onCheckedChange={() => handleTurmaToggle(turma.id)}
                          data-testid={`checkbox-turma-${turma.id}`}
                        />
                        <label
                          htmlFor={`turma-${turma.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {turma.nome}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma turma disponível</p>
                  )}
                </div>
              </div>
            )}

            {/* Tipo de Aviso */}
            <div className="space-y-2">
              <Label>Tipo de Aviso</Label>
              <Select value={tipoAviso} onValueChange={(value: "instantaneo" | "programado") => setTipoAviso(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instantaneo">Instantâneo (Ativa agora)</SelectItem>
                  <SelectItem value="programado">Programado (Ativa em data/hora específica)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoAviso === "programado" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Data de Início *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start-time">Hora de Início *</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Tipo de Duração */}
            <div className="space-y-2">
              <Label>Duração do Aviso</Label>
              <Select value={tipoDuracao} onValueChange={(value: "determinada" | "indeterminada") => setTipoDuracao(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="determinada">Determinada (Com data/hora de término)</SelectItem>
                  <SelectItem value="indeterminada">Indeterminada (Sem data de término)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoDuracao === "determinada" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="end-date">Data de Término *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Hora de Término *</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
              data-testid="button-cancel-create"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createAnnouncementMutation.mutate()}
              disabled={createAnnouncementMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createAnnouncementMutation.isPending ? "Criando..." : "Criar Aviso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Aviso */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-announcement">
          <DialogHeader>
            <DialogTitle>Editar Aviso</DialogTitle>
            <DialogDescription>
              Edite o título, slides, público-alvo e agendamento do aviso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Same form as create, but for editing */}
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título do Aviso *</Label>
              <Input
                id="edit-title"
                placeholder="Ex: Aviso Importante - Mudança de Horário"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Slides do Aviso *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSlide}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Slide
                </Button>
              </div>
              
              {slides.map((slide, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label>Slide {index + 1}</Label>
                      {slides.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlide(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <Select
                      value={slide.tipo}
                      onValueChange={(value: "texto" | "imagem") => updateSlideType(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="texto">Texto</SelectItem>
                        <SelectItem value="imagem">Imagem</SelectItem>
                      </SelectContent>
                    </Select>

                    {slide.tipo === "texto" ? (
                      <Textarea
                        placeholder="Digite o texto do slide..."
                        value={slide.conteudo}
                        onChange={(e) => updateSlideContent(index, e.target.value)}
                        rows={4}
                      />
                    ) : (
                      <>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, index)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Sugestão: Use imagens com proporção 16:9 (ex: 1280x720, 1920x1080) para melhor visualização
                        </p>
                        {slide.conteudo && (
                          <div className="mt-2 flex justify-center">
                            <img
                              src={slide.conteudo}
                              alt={`Preview slide ${index + 1}`}
                              className="max-w-full h-auto max-h-48 rounded-lg border"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Select value={announcementTarget} onValueChange={(value: "todos" | "alunos" | "professores" | "turmas") => {
                setAnnouncementTarget(value);
                setSelectedTurmas([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos (Alunos e Professores)</SelectItem>
                  <SelectItem value="alunos">Todos os Alunos</SelectItem>
                  <SelectItem value="professores">Todos os Professores</SelectItem>
                  <SelectItem value="turmas">Turmas Específicas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {announcementTarget === "turmas" && (
              <div className="space-y-2">
                <Label>Selecione as Turmas *</Label>
                <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                  {loadingTurmas ? (
                    <p className="text-sm text-muted-foreground">Carregando turmas...</p>
                  ) : turmas && turmas.length > 0 ? (
                    turmas.map((turma) => (
                      <div key={turma.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-turma-${turma.id}`}
                          checked={selectedTurmas.includes(turma.id)}
                          onCheckedChange={() => handleTurmaToggle(turma.id)}
                        />
                        <label
                          htmlFor={`edit-turma-${turma.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {turma.nome}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma turma disponível</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Aviso</Label>
              <Select value={tipoAviso} onValueChange={(value: "instantaneo" | "programado") => setTipoAviso(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instantaneo">Instantâneo (Ativa agora)</SelectItem>
                  <SelectItem value="programado">Programado (Ativa em data/hora específica)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoAviso === "programado" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-date">Data de Início *</Label>
                  <Input
                    id="edit-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-start-time">Hora de Início *</Label>
                  <Input
                    id="edit-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Duração do Aviso</Label>
              <Select value={tipoDuracao} onValueChange={(value: "determinada" | "indeterminada") => setTipoDuracao(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="determinada">Determinada (Com data/hora de término)</SelectItem>
                  <SelectItem value="indeterminada">Indeterminada (Sem data de término)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoDuracao === "determinada" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-end-date">Data de Término *</Label>
                  <Input
                    id="edit-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-time">Hora de Término *</Label>
                  <Input
                    id="edit-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => updateAnnouncementMutation.mutate()}
              disabled={updateAnnouncementMutation.isPending}
            >
              {updateAnnouncementMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Ativação */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Ativação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja ativar este aviso? Ele ficará visível para o público-alvo selecionado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedAnnouncement && activateAnnouncementMutation.mutate(selectedAnnouncement)}
              disabled={activateAnnouncementMutation.isPending}
            >
              {activateAnnouncementMutation.isPending ? "Ativando..." : "Confirmar Ativação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Desativação */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Desativação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar este aviso? Ele não ficará mais visível para o público-alvo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedAnnouncement && deactivateAnnouncementMutation.mutate(selectedAnnouncement)}
              disabled={deactivateAnnouncementMutation.isPending}
              variant="destructive"
            >
              {deactivateAnnouncementMutation.isPending ? "Desativando..." : "Confirmar Desativação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este aviso permanentemente? Esta ação não pode ser desfeita.
              {selectedAnnouncement?.arquivado && (
                <span className="text-destructive font-semibold block mt-2">
                  ⚠️ Avisos arquivados não podem ser excluídos (histórico de auditoria permanente).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedAnnouncement && deleteAnnouncementMutation.mutate(selectedAnnouncement.id)}
              disabled={deleteAnnouncementMutation.isPending || selectedAnnouncement?.arquivado}
              variant="destructive"
            >
              {deleteAnnouncementMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Arquivar com Justificativa */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar Aviso</DialogTitle>
            <DialogDescription>
              Arquive este aviso no histórico de auditoria. É obrigatório adicionar uma justificativa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="archive-justification">Justificativa *</Label>
              <Textarea
                id="archive-justification"
                placeholder="Descreva o motivo do arquivamento..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setArchiveDialogOpen(false);
              setJustificativa("");
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => archiveAnnouncementMutation.mutate()}
              disabled={archiveAnnouncementMutation.isPending || !justificativa.trim()}
            >
              {archiveAnnouncementMutation.isPending ? "Arquivando..." : "Arquivar Aviso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Adicionar Justificativa */}
      <Dialog open={justifyDialogOpen} onOpenChange={setJustifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Justificativa</DialogTitle>
            <DialogDescription>
              Adicione uma justificativa para este aviso. Isso é útil para documentar o propósito do aviso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="justification">Justificativa *</Label>
              <Textarea
                id="justification"
                placeholder="Descreva o propósito ou motivo deste aviso..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setJustifyDialogOpen(false);
              setJustificativa("");
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => addJustificationMutation.mutate()}
              disabled={addJustificationMutation.isPending || !justificativa.trim()}
            >
              {addJustificationMutation.isPending ? "Salvando..." : "Salvar Justificativa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
