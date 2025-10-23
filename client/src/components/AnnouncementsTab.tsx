import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { collection, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
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
import { Plus, Trash2, Edit, Megaphone, Image as ImageIcon, FileText, Eye, EyeOff } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import type { Announcement, Turma } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

export function AnnouncementsTab() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [announcementType, setAnnouncementType] = useState<"texto" | "imagem">("texto");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState<"alunos" | "professores" | "turmas">("alunos");
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const createAnnouncementMutation = useMutation({
    mutationFn: async () => {
      if (!userData) throw new Error("Usuário não autenticado");

      if (announcementType === "texto" && !announcementContent.trim()) {
        throw new Error("O texto do aviso é obrigatório");
      }

      if (announcementType === "imagem" && !imagePreview) {
        throw new Error("Selecione uma imagem para o aviso");
      }

      if (announcementTarget === "turmas" && selectedTurmas.length === 0) {
        throw new Error("Selecione pelo menos uma turma");
      }

      await addDoc(collection(db, "announcements"), {
        tipo: announcementType,
        conteudo: announcementType === "texto" ? announcementContent : imagePreview,
        publicoAlvo: announcementTarget,
        turmasSelecionadas: announcementTarget === "turmas" ? selectedTurmas : [],
        ativo: true,
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        dataCriacao: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Aviso criado!",
        description: "O aviso foi criado com sucesso",
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

      if (announcementType === "texto" && !announcementContent.trim()) {
        throw new Error("O texto do aviso é obrigatório");
      }

      if (announcementType === "imagem" && !imagePreview) {
        throw new Error("Selecione uma imagem para o aviso");
      }

      if (announcementTarget === "turmas" && selectedTurmas.length === 0) {
        throw new Error("Selecione pelo menos uma turma");
      }

      await updateDoc(doc(db, "announcements", selectedAnnouncement.id), {
        tipo: announcementType,
        conteudo: announcementType === "texto" ? announcementContent : imagePreview,
        publicoAlvo: announcementTarget,
        turmasSelecionadas: announcementTarget === "turmas" ? selectedTurmas : [],
        dataAtualizacao: new Date().toISOString(),
      });
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

  const toggleAnnouncementMutation = useMutation({
    mutationFn: async (announcement: Announcement) => {
      await updateDoc(doc(db, "announcements", announcement.id), {
        ativo: !announcement.ativo,
        dataAtualizacao: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do aviso",
        variant: "destructive",
      });
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (announcementId: string) => {
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

  const resetForm = () => {
    setAnnouncementType("texto");
    setAnnouncementContent("");
    setAnnouncementTarget("alunos");
    setSelectedTurmas([]);
    setImageFile(null);
    setImagePreview(null);
    setSelectedAnnouncement(null);
  };

  const openEditDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setAnnouncementType(announcement.tipo);
    setAnnouncementContent(announcement.tipo === "texto" ? announcement.conteudo : "");
    setImagePreview(announcement.tipo === "imagem" ? announcement.conteudo : null);
    setAnnouncementTarget(announcement.publicoAlvo);
    setSelectedTurmas(announcement.turmasSelecionadas || []);
    setEditDialogOpen(true);
  };

  const handleTurmaToggle = (turmaId: string) => {
    setSelectedTurmas(prev =>
      prev.includes(turmaId)
        ? prev.filter(id => id !== turmaId)
        : [...prev, turmaId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Quadro de Avisos</h3>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-announcement">
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      {loadingAnnouncements ? (
        <>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </>
      ) : announcements && announcements.length > 0 ? (
        <div className="grid gap-4">
          {announcements
            .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
            .map((announcement) => (
              <Card key={announcement.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {announcement.tipo === "texto" ? (
                          <FileText className="h-5 w-5 text-primary" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          Aviso {announcement.tipo === "texto" ? "de Texto" : "com Imagem"}
                        </CardTitle>
                        <CardDescription>
                          Criado em {new Date(announcement.dataCriacao).toLocaleDateString('pt-BR')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={announcement.ativo ? "default" : "secondary"}>
                        {announcement.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline">
                        {announcement.publicoAlvo === "alunos" ? "Alunos" :
                         announcement.publicoAlvo === "professores" ? "Professores" :
                         `${announcement.turmasSelecionadas?.length || 0} turma(s)`}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {announcement.tipo === "texto" ? (
                    <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg">
                      {announcement.conteudo}
                    </p>
                  ) : (
                    <div className="flex justify-center">
                      <img
                        src={announcement.conteudo}
                        alt="Aviso"
                        className="max-w-full h-auto max-h-96 rounded-lg border"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAnnouncementMutation.mutate(announcement)}
                      disabled={toggleAnnouncementMutation.isPending}
                    >
                      {announcement.ativo ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      {announcement.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(announcement)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
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
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Megaphone className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhum aviso criado</p>
            <p className="text-sm text-muted-foreground">Crie avisos para alunos e professores visualizarem</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-announcement">
          <DialogHeader>
            <DialogTitle>Criar Novo Aviso</DialogTitle>
            <DialogDescription>
              Crie um aviso em formato de texto ou imagem para alunos e professores
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Aviso</Label>
              <Select value={announcementType} onValueChange={(value: "texto" | "imagem") => {
                setAnnouncementType(value);
                setAnnouncementContent("");
                setImageFile(null);
                setImagePreview(null);
              }}>
                <SelectTrigger data-testid="select-announcement-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="imagem">Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {announcementType === "texto" ? (
              <div className="space-y-2">
                <Label htmlFor="content">Texto do Aviso *</Label>
                <Textarea
                  id="content"
                  placeholder="Digite o texto do aviso..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  rows={6}
                  data-testid="textarea-announcement-content"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="image">Imagem do Aviso *</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  data-testid="input-announcement-image"
                />
                {imagePreview && (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full h-auto max-h-96 rounded-lg border"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Select value={announcementTarget} onValueChange={(value: "alunos" | "professores" | "turmas") => {
                setAnnouncementTarget(value);
                setSelectedTurmas([]);
              }}>
                <SelectTrigger data-testid="select-announcement-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-announcement">
          <DialogHeader>
            <DialogTitle>Editar Aviso</DialogTitle>
            <DialogDescription>
              Edite o conteúdo e configurações do aviso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Aviso</Label>
              <Select value={announcementType} onValueChange={(value: "texto" | "imagem") => {
                setAnnouncementType(value);
                setAnnouncementContent("");
                setImageFile(null);
                setImagePreview(null);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="imagem">Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {announcementType === "texto" ? (
              <div className="space-y-2">
                <Label htmlFor="edit-content">Texto do Aviso *</Label>
                <Textarea
                  id="edit-content"
                  placeholder="Digite o texto do aviso..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  rows={6}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-image">Imagem do Aviso *</Label>
                <Input
                  id="edit-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full h-auto max-h-96 rounded-lg border"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Select value={announcementTarget} onValueChange={(value: "alunos" | "professores" | "turmas") => {
                setAnnouncementTarget(value);
                setSelectedTurmas([]);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-announcement">
          <DialogHeader>
            <DialogTitle>Excluir Aviso</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedAnnouncement(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedAnnouncement && deleteAnnouncementMutation.mutate(selectedAnnouncement.id)}
              disabled={deleteAnnouncementMutation.isPending}
            >
              {deleteAnnouncementMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
