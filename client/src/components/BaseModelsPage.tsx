import { useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, where, writeBatch } from "firebase/firestore";
import {
  Archive,
  BookOpen,
  Copy,
  Download,
  Edit,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  Link2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useToast } from "@/hooks/use-toast";
import { fileToFirestoreDataUrl, validateFile } from "@/lib/fileValidation";
import { getNowBrasiliaISO } from "@/lib/brasiliaTime";
import {
  BASE_MODEL_CATEGORIES,
  BASE_MODEL_FILE_FORMATS,
  BASE_MODEL_TYPES,
  getBaseModelType,
  type BaseModelCategory,
  type BaseModelTypeDefinition,
} from "@/lib/baseModelCatalog";
import type { MateriaCustomizada, ModeloBase, ModeloBaseDownload, Turma, User } from "@shared/schema";
import { MATERIAS_DISPONIVEIS, MATERIAS_SEM_PROFESSOR } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MAX_EMBEDDED_FILE_BYTES = 450 * 1024;

type ProfessorCriterion = "todos" | "materias" | "selecionados";
type TurmaCriterion = "todas" | "selecionadas";
type FileOrigin = "arquivo" | "link";

interface ModelFormState {
  titulo: string;
  categoriaId: string;
  tipoId: string;
  aplicabilidade: string;
  descricao: string;
  origem: FileOrigin;
  formato: string;
  linkExterno: string;
  criterioProfessores: ProfessorCriterion;
  materiasSelecionadas: string[];
  professoresSelecionados: string[];
  criterioTurmas: TurmaCriterion;
  turmasSelecionadas: string[];
  ativo: boolean;
}

interface CustomBaseModelCategory extends BaseModelCategory {
  ativo?: boolean;
  criadoPor?: string;
  criadoPorNome?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

interface CustomBaseModelType extends BaseModelTypeDefinition {
  ativo?: boolean;
  criadoPor?: string;
  criadoPorNome?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

const emptyForm: ModelFormState = {
  titulo: "",
  categoriaId: "avaliacoes",
  tipoId: "atividade-avaliativa",
  aplicabilidade: getBaseModelType("atividade-avaliativa")?.applicability || "",
  descricao: "",
  origem: "arquivo",
  formato: "docx",
  linkExterno: "",
  criterioProfessores: "todos",
  materiasSelecionadas: [],
  professoresSelecionados: [],
  criterioTurmas: "todas",
  turmasSelecionadas: [],
  ativo: true,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function getExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : "";
}

function buildStandardFileName(typeLabel: string, title: string, extension: string) {
  const typePart = sanitizeFilePart(typeLabel) || "Modelo";
  const titlePart = sanitizeFilePart(title) || "Base";
  const ext = extension.replace(/^\./, "").toLowerCase() || "arquivo";
  return `${typePart} - ${titlePart}.${ext}`;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function userTurmas(user: User) {
  const values = [...(user.turmas || [])];
  if (user.turma) values.push(user.turma);
  return Array.from(new Set(values.filter(Boolean)));
}

function intersects(a: string[], b: string[]) {
  return a.some((item) => b.includes(item));
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function modelIcon(format: string) {
  if (["xlsx", "xls", "xltx", "csv", "ods", "ots"].includes(format)) return FileSpreadsheet;
  if (["zip"].includes(format)) return FileArchive;
  return FileText;
}

function isValidExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function BaseModelsPage() {
  const { userData } = useAuth();
  const { toast } = useToast();
  const isDirector = userData?.tipo === "diretor";
  const isProfessor = userData?.tipo === "professor";
  const uid = userData?.uid || "";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ModeloBase | null>(null);
  const [form, setForm] = useState<ModelFormState>(emptyForm);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typeCategoryId, setTypeCategoryId] = useState("avaliacoes");
  const [typeApplicability, setTypeApplicability] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);

  const { data: adminModels, isLoading: loadingAdmin } = useRealtimeQuery<ModeloBase>({
    collectionName: "modelosBase",
    queryKey: ["modelos-base", "diretor"],
    enabled: isDirector,
  });

  const { data: globalProfessorModels, isLoading: loadingGlobal } = useRealtimeQuery<ModeloBase>({
    collectionName: "modelosBase",
    queryKey: ["modelos-base", "professor", "globais", uid],
    constraints: isProfessor ? [where("ativo", "==", true), where("publicoTodosProfessores", "==", true)] : [],
    enabled: isProfessor && Boolean(uid),
  });

  const { data: targetedProfessorModels, isLoading: loadingTargeted } = useRealtimeQuery<ModeloBase>({
    collectionName: "modelosBase",
    queryKey: ["modelos-base", "professor", "direcionados", uid],
    constraints: isProfessor ? [where("ativo", "==", true), where("professoresLiberados", "array-contains", uid)] : [],
    enabled: isProfessor && Boolean(uid),
  });

  const { data: downloads } = useRealtimeQuery<ModeloBaseDownload>({
    collectionName: "modelosBaseDownloads",
    queryKey: ["modelos-base-downloads"],
    enabled: isDirector,
  });

  const { data: customCategories } = useRealtimeQuery<CustomBaseModelCategory>({
    collectionName: "modelosBaseCategorias",
    queryKey: ["modelos-base-categorias"],
    enabled: isDirector || isProfessor,
  });

  const { data: customTypes } = useRealtimeQuery<CustomBaseModelType>({
    collectionName: "modelosBaseTipos",
    queryKey: ["modelos-base-tipos"],
    enabled: isDirector || isProfessor,
  });

  const { data: professors } = useRealtimeQuery<User>({
    collectionName: "usuarios",
    queryKey: ["modelos-base-professores"],
    constraints: isDirector ? [where("tipo", "==", "professor")] : [],
    enabled: isDirector,
  });

  const { data: turmas } = useRealtimeQuery<Turma>({
    collectionName: "turmas",
    queryKey: ["modelos-base-turmas"],
    enabled: isDirector || isProfessor,
  });

  const { data: materiasCustomizadas } = useRealtimeQuery<MateriaCustomizada>({
    collectionName: "materiasCustomizadas",
    queryKey: ["modelos-base-materias"],
    enabled: isDirector,
  });

  const models = useMemo(() => {
    if (isDirector) return adminModels || [];
    const merged = [...(globalProfessorModels || []), ...(targetedProfessorModels || [])];
    const byId = new Map<string, ModeloBase>();
    merged.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values());
  }, [adminModels, globalProfessorModels, targetedProfessorModels, isDirector]);

  const activeProfessors = useMemo(
    () => (professors || []).filter((item) => item.tipo === "professor" && item.ativo !== false && item.status !== "reprovado"),
    [professors],
  );

  const allSubjects = useMemo(() => {
    const custom = (materiasCustomizadas || []).filter((item) => item.ativo !== false).map((item) => item.nome);
    return Array.from(new Set([...MATERIAS_DISPONIVEIS, ...MATERIAS_SEM_PROFESSOR, ...custom])).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [materiasCustomizadas]);

  const activeClasses = useMemo(
    () => (turmas || []).filter((item) => item.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [turmas],
  );

  const downloadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (downloads || []).forEach((item) => counts.set(item.modeloId, (counts.get(item.modeloId) || 0) + 1));
    return counts;
  }, [downloads]);

  const allCategories = useMemo<BaseModelCategory[]>(() => {
    const custom = (customCategories || [])
      .filter((item) => item.ativo !== false)
      .map((item) => ({ id: item.id, label: item.label }));
    return [...BASE_MODEL_CATEGORIES, ...custom];
  }, [customCategories]);

  const allTypes = useMemo<BaseModelTypeDefinition[]>(() => {
    const custom = (customTypes || [])
      .filter((item) => item.ativo !== false)
      .map((item) => ({ id: item.id, categoryId: item.categoryId, label: item.label, applicability: item.applicability }));
    return [...BASE_MODEL_TYPES, ...custom];
  }, [customTypes]);

  const getCategoryDefinition = (id: string) => allCategories.find((item) => item.id === id);
  const getTypeDefinition = (id: string) => allTypes.find((item) => item.id === id);

  const filteredModels = useMemo(() => {
    const queryText = normalize(search);
    return models
      .filter((item) => categoryFilter === "todas" || item.categoriaId === categoryFilter)
      .filter((item) => {
        if (!queryText) return true;
        return normalize([
          item.titulo,
          item.tipoLabel,
          item.categoriaLabel,
          item.aplicabilidade,
          item.descricao || "",
          ...(item.materiasSelecionadas || []),
          ...(item.turmasSelecionadas || []),
        ].join(" ")).includes(queryText);
      })
      .sort((a, b) => (b.atualizadoEm || b.criadoEm || "").localeCompare(a.atualizadoEm || a.criadoEm || ""));
  }, [models, search, categoryFilter]);

  const selectedTypes = useMemo(
    () => allTypes.filter((item) => item.categoryId === form.categoriaId),
    [allTypes, form.categoriaId],
  );

  const resetDialog = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setUploadFile(null);
  };

  const openNew = () => {
    resetDialog();
    setDialogOpen(true);
  };

  const openEdit = (model: ModeloBase) => {
    setEditing(model);
    setUploadFile(null);
    setForm({
      titulo: model.titulo,
      categoriaId: model.categoriaId,
      tipoId: model.tipoId,
      aplicabilidade: model.aplicabilidade,
      descricao: model.descricao || "",
      origem: model.origem,
      formato: model.formato,
      linkExterno: model.linkExterno || "",
      criterioProfessores: model.criterioProfessores,
      materiasSelecionadas: model.materiasSelecionadas || [],
      professoresSelecionados: model.professoresSelecionados || [],
      criterioTurmas: model.criterioTurmas,
      turmasSelecionadas: model.turmasSelecionadas || [],
      ativo: model.ativo !== false,
    });
    setDialogOpen(true);
  };

  const updateCategory = (categoryId: string) => {
    const categoryTypes = allTypes.filter((item) => item.categoryId === categoryId);
    const firstType = categoryTypes[0];
    setForm((previous) => ({
      ...previous,
      categoriaId: categoryId,
      tipoId: firstType?.id || "",
      aplicabilidade: firstType?.applicability || "",
    }));
  };

  const updateType = (typeId: string) => {
    const type = getTypeDefinition(typeId);
    setForm((previous) => ({
      ...previous,
      tipoId: typeId,
      aplicabilidade: type?.applicability || previous.aplicabilidade,
    }));
  };

  const resetCategoryEditor = () => {
    setEditingCategoryId(null);
    setCategoryName("");
  };

  const resetTypeEditor = () => {
    setEditingTypeId(null);
    setTypeName("");
    setTypeApplicability("");
    setTypeCategoryId(allCategories[0]?.id || "avaliacoes");
  };

  const saveCustomCategory = async () => {
    if (!isDirector || !userData) return;
    const label = categoryName.trim();
    if (!label) {
      toast({ title: "Informe o nome da categoria", variant: "destructive" });
      return;
    }
    const duplicate = allCategories.some((item) => item.id !== editingCategoryId && normalize(item.label) === normalize(label));
    if (duplicate) {
      toast({ title: "Categoria já existente", description: "Use outro nome para a categoria.", variant: "destructive" });
      return;
    }

    setSavingCatalog(true);
    try {
      const now = getNowBrasiliaISO();
      const ref = editingCategoryId
        ? doc(db, "modelosBaseCategorias", editingCategoryId)
        : doc(collection(db, "modelosBaseCategorias"));
      const batch = writeBatch(db);
      if (editingCategoryId) {
        batch.update(ref, { label, ativo: true, atualizadoEm: now, atualizadoPor: userData.uid, atualizadoPorNome: userData.nome });
        models.filter((item) => item.categoriaId === editingCategoryId).forEach((item) => {
          batch.update(doc(db, "modelosBase", item.id), { categoriaLabel: label, atualizadoEm: now });
        });
      } else {
        batch.set(ref, { label, ativo: true, criadoEm: now, criadoPor: userData.uid, criadoPorNome: userData.nome });
      }
      await batch.commit();
      toast({ title: editingCategoryId ? "Categoria atualizada" : "Categoria criada", description: label });
      if (!editingCategoryId) setTypeCategoryId(ref.id);
      resetCategoryEditor();
    } catch (error: any) {
      console.error("Erro ao salvar categoria de Modelos Base:", error);
      toast({ title: "Erro ao salvar categoria", description: error?.message || "Não foi possível salvar a categoria.", variant: "destructive" });
    } finally {
      setSavingCatalog(false);
    }
  };

  const saveCustomType = async () => {
    if (!isDirector || !userData) return;
    const label = typeName.trim();
    const applicability = typeApplicability.trim();
    if (!typeCategoryId) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }
    if (!label) {
      toast({ title: "Informe o nome do tipo", variant: "destructive" });
      return;
    }
    if (!applicability) {
      toast({ title: "Informe a aplicabilidade", description: "Explique em qual situação esse tipo deve ser utilizado.", variant: "destructive" });
      return;
    }
    const duplicate = allTypes.some((item) => item.id !== editingTypeId && item.categoryId === typeCategoryId && normalize(item.label) === normalize(label));
    if (duplicate) {
      toast({ title: "Tipo já existente nesta categoria", variant: "destructive" });
      return;
    }

    setSavingCatalog(true);
    try {
      const now = getNowBrasiliaISO();
      const ref = editingTypeId
        ? doc(db, "modelosBaseTipos", editingTypeId)
        : doc(collection(db, "modelosBaseTipos"));
      const batch = writeBatch(db);
      if (editingTypeId) {
        batch.update(ref, { categoryId: typeCategoryId, label, applicability, ativo: true, atualizadoEm: now, atualizadoPor: userData.uid, atualizadoPorNome: userData.nome });
        models.filter((item) => item.tipoId === editingTypeId).forEach((item) => {
          batch.update(doc(db, "modelosBase", item.id), { tipoLabel: label, categoriaId: typeCategoryId, categoriaLabel: getCategoryDefinition(typeCategoryId)?.label || item.categoriaLabel, atualizadoEm: now });
        });
      } else {
        batch.set(ref, { categoryId: typeCategoryId, label, applicability, ativo: true, criadoEm: now, criadoPor: userData.uid, criadoPorNome: userData.nome });
      }
      await batch.commit();
      toast({ title: editingTypeId ? "Tipo atualizado" : "Tipo criado", description: label });
      resetTypeEditor();
    } catch (error: any) {
      console.error("Erro ao salvar tipo de Modelos Base:", error);
      toast({ title: "Erro ao salvar tipo", description: error?.message || "Não foi possível salvar o tipo.", variant: "destructive" });
    } finally {
      setSavingCatalog(false);
    }
  };

  const editCustomCategory = (item: CustomBaseModelCategory) => {
    setEditingCategoryId(item.id);
    setCategoryName(item.label);
  };

  const editCustomType = (item: CustomBaseModelType) => {
    setEditingTypeId(item.id);
    setTypeCategoryId(item.categoryId);
    setTypeName(item.label);
    setTypeApplicability(item.applicability);
  };

  const deleteCustomCategory = async (item: CustomBaseModelCategory) => {
    if (!isDirector) return;
    if ((customTypes || []).some((type) => type.categoryId === item.id)) {
      toast({ title: "Categoria em uso", description: "Exclua ou mova os tipos personalizados desta categoria antes de apagá-la.", variant: "destructive" });
      return;
    }
    if (models.some((model) => model.categoriaId === item.id)) {
      toast({ title: "Categoria em uso", description: "Existem modelos publicados nesta categoria. Mova-os para outra categoria antes de apagar.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Excluir a categoria “${item.label}”?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "modelosBaseCategorias", item.id));
      await batch.commit();
      if (form.categoriaId === item.id) updateCategory(BASE_MODEL_CATEGORIES[0].id);
      toast({ title: "Categoria excluída" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir categoria", description: error?.message || "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const deleteCustomType = async (item: CustomBaseModelType) => {
    if (!isDirector) return;
    if (models.some((model) => model.tipoId === item.id)) {
      toast({ title: "Tipo em uso", description: "Existem modelos publicados com este tipo. Altere os modelos antes de apagar.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Excluir o tipo “${item.label}”?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "modelosBaseTipos", item.id));
      await batch.commit();
      if (form.tipoId === item.id) updateCategory(form.categoriaId);
      toast({ title: "Tipo excluído" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir tipo", description: error?.message || "Não foi possível excluir.", variant: "destructive" });
    }
  };

  const resolveEligibleProfessorIds = () => {
    let candidates: User[] = [];

    if (form.criterioProfessores === "todos") {
      candidates = [...activeProfessors];
    } else if (form.criterioProfessores === "selecionados") {
      candidates = activeProfessors.filter((item) => form.professoresSelecionados.includes(item.uid));
    } else {
      candidates = activeProfessors.filter((item) => intersects(item.materias || [], form.materiasSelecionadas));
    }

    if (form.criterioTurmas === "selecionadas") {
      candidates = candidates.filter((item) => intersects(userTurmas(item), form.turmasSelecionadas));
    }

    return Array.from(new Set(candidates.map((item) => item.uid)));
  };

  const validateForm = () => {
    if (!form.titulo.trim()) return "Informe o título do modelo.";
    if (!form.tipoId) return "Selecione o tipo do modelo.";
    if (!form.aplicabilidade.trim()) return "Informe para qual situação este modelo deve ser usado.";
    if (form.criterioProfessores === "materias" && form.materiasSelecionadas.length === 0) return "Selecione pelo menos uma matéria.";
    if (form.criterioProfessores === "selecionados" && form.professoresSelecionados.length === 0) return "Selecione pelo menos um professor.";
    if (form.criterioTurmas === "selecionadas" && form.turmasSelecionadas.length === 0) return "Selecione pelo menos uma turma.";

    if (form.origem === "arquivo") {
      if ((!editing || editing.origem !== "arquivo") && !uploadFile) return "Selecione um arquivo para publicar.";
      if (uploadFile) {
        const result = validateFile(uploadFile, MAX_EMBEDDED_FILE_BYTES);
        if (!result.isValid) return `${result.error}. Para arquivos maiores, escolha Link externo.`;
      }
    } else {
      if (!isValidExternalUrl(form.linkExterno)) return "Informe um link externo válido começando com http:// ou https://.";
      if (form.formato === "link") {
        // Link genérico é permitido e será nomeado sem extensão específica.
      }
    }

    if (resolveEligibleProfessorIds().length === 0 && !(form.criterioProfessores === "todos" && form.criterioTurmas === "todas")) {
      return "Nenhum professor atual corresponde aos filtros escolhidos. Ajuste professores, matérias ou turmas.";
    }
    return null;
  };

  const saveModel = async () => {
    if (!isDirector || !userData) return;
    const validationError = validateForm();
    if (validationError) {
      toast({ title: "Revise a publicação", description: validationError, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const type = getTypeDefinition(form.tipoId);
      const category = getCategoryDefinition(form.categoriaId);
      const eligibleProfessorIds = resolveEligibleProfessorIds();
      const globalForAllProfessors = form.criterioProfessores === "todos" && form.criterioTurmas === "todas";

      let extension = editing?.extensao || form.formato;
      let format = form.formato;
      let fileDataUrl: string | undefined;
      let originalName = editing?.arquivoNomeOriginal;
      let mimeType = editing?.arquivoMimeType;
      let sizeBytes = editing?.arquivoTamanhoBytes;

      if (form.origem === "arquivo" && uploadFile) {
        extension = getExtension(uploadFile.name) || form.formato;
        format = extension;
        fileDataUrl = await fileToFirestoreDataUrl(uploadFile, MAX_EMBEDDED_FILE_BYTES);
        originalName = uploadFile.name;
        mimeType = uploadFile.type || "application/octet-stream";
        sizeBytes = uploadFile.size;
      }

      if (form.origem === "link") {
        extension = form.formato === "link" ? "link" : form.formato;
        fileDataUrl = undefined;
        originalName = undefined;
        mimeType = undefined;
        sizeBytes = undefined;
      }

      const standardName = form.formato === "link" && form.origem === "link"
        ? `${sanitizeFilePart(type?.label || "Modelo")} - ${sanitizeFilePart(form.titulo)}`
        : buildStandardFileName(type?.label || "Modelo", form.titulo, extension || format);

      const now = getNowBrasiliaISO();
      const payload: Record<string, unknown> = {
        titulo: form.titulo.trim(),
        categoriaId: form.categoriaId,
        categoriaLabel: category?.label || "Outros modelos",
        tipoId: form.tipoId,
        tipoLabel: type?.label || "Outro modelo/documento",
        aplicabilidade: form.aplicabilidade.trim(),
        descricao: form.descricao.trim(),
        origem: form.origem,
        formato: format,
        extensao: extension,
        arquivoNomePadronizado: standardName,
        criterioProfessores: form.criterioProfessores,
        materiasSelecionadas: form.materiasSelecionadas,
        professoresSelecionados: form.professoresSelecionados,
        professoresLiberados: globalForAllProfessors ? [] : eligibleProfessorIds,
        publicoTodosProfessores: globalForAllProfessors,
        criterioTurmas: form.criterioTurmas,
        turmasSelecionadas: form.turmasSelecionadas,
        ativo: form.ativo,
        linkExterno: form.origem === "link" ? form.linkExterno.trim() : "",
        arquivoNomeOriginal: originalName || "",
        arquivoMimeType: mimeType || "",
        arquivoTamanhoBytes: sizeBytes || 0,
      };

      const batch = writeBatch(db);
      if (editing) {
        const modelRef = doc(db, "modelosBase", editing.id);
        batch.update(modelRef, {
          ...payload,
          versao: (editing.versao || 1) + 1,
          atualizadoPor: userData.uid,
          atualizadoPorNome: userData.nome,
          atualizadoEm: now,
        });

        const fileRef = doc(db, "modelosBaseArquivos", editing.id);
        if (form.origem === "arquivo" && fileDataUrl) {
          batch.set(fileRef, {
            modeloId: editing.id,
            dataUrl: fileDataUrl,
            nomeArquivo: standardName,
            mimeType: mimeType || "application/octet-stream",
            tamanhoBytes: sizeBytes || 0,
            atualizadoEm: now,
          });
        } else if (form.origem === "link") {
          batch.delete(fileRef);
        }
        await batch.commit();
        toast({ title: "Modelo atualizado", description: `${standardName} foi atualizado e a nova versão já está disponível.` });
      } else {
        const modelRef = doc(collection(db, "modelosBase"));
        batch.set(modelRef, {
          ...payload,
          versao: 1,
          criadoPor: userData.uid,
          criadoPorNome: userData.nome,
          criadoEm: now,
        });
        if (form.origem === "arquivo" && fileDataUrl) {
          batch.set(doc(db, "modelosBaseArquivos", modelRef.id), {
            modeloId: modelRef.id,
            dataUrl: fileDataUrl,
            nomeArquivo: standardName,
            mimeType: mimeType || "application/octet-stream",
            tamanhoBytes: sizeBytes || 0,
            atualizadoEm: now,
          });
        }
        await batch.commit();
        toast({ title: "Modelo publicado", description: `${standardName} foi adicionado à biblioteca institucional.` });
      }

      setDialogOpen(false);
      resetDialog();
    } catch (error: any) {
      console.error("Erro ao salvar modelo base:", error);
      toast({ title: "Erro ao salvar", description: error?.message || "Não foi possível salvar o modelo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async (model: ModeloBase) => {
    if (!isDirector) return;
    if (!window.confirm(`Excluir definitivamente o modelo “${model.titulo}”? Esta ação não pode ser desfeita.`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "modelosBase", model.id));
      batch.delete(doc(db, "modelosBaseArquivos", model.id));
      await batch.commit();
      toast({ title: "Modelo excluído", description: "O arquivo foi removido da biblioteca de modelos." });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error?.message || "Não foi possível excluir o modelo.", variant: "destructive" });
    }
  };

  const duplicateModel = async (model: ModeloBase) => {
    if (!isDirector || !userData) return;
    const now = getNowBrasiliaISO();
    try {
      const { id: _id, ...rest } = model;
      const copyTitle = `${model.titulo} - Cópia`;
      const copyFileName = buildStandardFileName(model.tipoLabel, copyTitle, model.extensao || model.formato);
      const newModelRef = doc(collection(db, "modelosBase"));
      const batch = writeBatch(db);
      batch.set(newModelRef, {
        ...rest,
        titulo: copyTitle,
        arquivoNomePadronizado: copyFileName,
        versao: 1,
        criadoPor: userData.uid,
        criadoPorNome: userData.nome,
        criadoEm: now,
        atualizadoPor: "",
        atualizadoPorNome: "",
        atualizadoEm: "",
      });
      if (model.origem === "arquivo") {
        const fileSnap = await getDoc(doc(db, "modelosBaseArquivos", model.id));
        if (fileSnap.exists()) {
          batch.set(doc(db, "modelosBaseArquivos", newModelRef.id), {
            ...fileSnap.data(),
            modeloId: newModelRef.id,
            nomeArquivo: copyFileName,
            atualizadoEm: now,
          });
        }
      }
      await batch.commit();
      toast({ title: "Modelo duplicado", description: "Uma cópia editável foi criada para a diretoria." });
    } catch (error: any) {
      toast({ title: "Erro ao duplicar", description: error?.message || "Não foi possível duplicar.", variant: "destructive" });
    }
  };

  const registerDownload = async (model: ModeloBase) => {
    if (!isProfessor || !userData) return;
    try {
      await addDoc(collection(db, "modelosBaseDownloads"), {
        modeloId: model.id,
        modeloTitulo: model.titulo,
        arquivoNome: model.arquivoNomePadronizado,
        professorId: userData.uid,
        professorNome: userData.nome,
        baixadoEm: getNowBrasiliaISO(),
      });
    } catch (error) {
      console.error("Não foi possível registrar o download do modelo:", error);
    }
  };

  const downloadModel = async (model: ModeloBase) => {
    if (!model.ativo && !isDirector) return;
    if (model.origem === "arquivo") {
      try {
        const fileSnap = await getDoc(doc(db, "modelosBaseArquivos", model.id));
        if (!fileSnap.exists() || !fileSnap.data().dataUrl) {
          throw new Error("Arquivo incorporado não encontrado.");
        }
        downloadDataUrl(String(fileSnap.data().dataUrl), model.arquivoNomePadronizado);
        await registerDownload(model);
        return;
      } catch (error: any) {
        toast({ title: "Arquivo indisponível", description: error?.message || "Não foi possível carregar o arquivo.", variant: "destructive" });
        return;
      }
    }
    if (model.origem === "link" && model.linkExterno) {
      const anchor = document.createElement("a");
      anchor.href = model.linkExterno;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = model.arquivoNomePadronizado;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      await registerDownload(model);
      return;
    }
    toast({ title: "Arquivo indisponível", description: "Este modelo não possui arquivo ou link válido.", variant: "destructive" });
  };

  const loading = isDirector ? loadingAdmin : loadingGlobal || loadingTargeted;

  if (!isDirector && !isProfessor) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>Acesso restrito</AlertTitle>
        <AlertDescription>Modelos Base é uma área exclusiva da Diretoria/Coordenação e dos professores.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Modelos Base</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {isDirector
              ? "Biblioteca institucional controlada pela Diretoria/Coordenação. Publique, atualize e direcione modelos para professores, matérias e turmas específicas."
              : "Baixe os modelos oficiais liberados para você. Os arquivos são controlados pela Diretoria/Coordenação e não podem ser alterados, apagados ou publicados por professores dentro do portal."}
          </p>
        </div>
        {isDirector && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCatalogDialogOpen(true)} className="gap-2" data-testid="button-manage-base-model-catalog">
              <Archive className="h-4 w-4" />
              Categorias e tipos
            </Button>
            <Button onClick={openNew} className="gap-2" data-testid="button-new-base-model">
              <Plus className="h-4 w-4" />
              Novo modelo
            </Button>
          </div>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Arquivos sem Firebase Storage</AlertTitle>
        <AlertDescription>
          Arquivos de até 450 KB podem ser gravados diretamente no Firestore. Para arquivos maiores, use um link externo de Google Drive, OneDrive, SharePoint ou outro serviço e deixe a permissão externa como somente leitura/download.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Modelos disponíveis</p><p className="text-xl font-bold">{models.filter((item) => item.ativo !== false).length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><BookOpen className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Categorias escolares</p><p className="text-xl font-bold">{allCategories.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><GraduationCap className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Tipos cadastráveis</p><p className="text-xl font-bold">{allTypes.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_260px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar título, tipo, matéria, turma ou aplicabilidade..." className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {allCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Carregando biblioteca de modelos...</CardContent></Card>
      ) : filteredModels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
            <div><p className="font-semibold">Nenhum modelo encontrado</p><p className="text-sm text-muted-foreground">{isDirector ? "Publique o primeiro modelo institucional." : "Ainda não há modelos liberados para seu perfil."}</p></div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredModels.map((model) => {
            const Icon = modelIcon(model.formato);
            const classLabels = model.criterioTurmas === "todas"
              ? ["Todas as turmas"]
              : (model.turmasSelecionadas || []).map((id) => activeClasses.find((item) => item.id === id)?.nome || id);
            const audience = model.criterioProfessores === "todos"
              ? "Todos os professores"
              : model.criterioProfessores === "materias"
                ? `Professores de: ${(model.materiasSelecionadas || []).join(", ")}`
                : `${(model.professoresSelecionados || []).length} professor(es) selecionado(s)`;

            return (
              <Card key={model.id} className={!model.ativo ? "opacity-65" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="rounded-lg bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div>
                      <div className="min-w-0">
                        <CardTitle className="text-base leading-tight">{model.titulo}</CardTitle>
                        <CardDescription className="mt-1">{model.tipoLabel}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge variant="outline">v{model.versao || 1}</Badge>
                      {!model.ativo && <Badge variant="secondary">Desativado</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quando usar</p>
                    <p className="text-sm leading-relaxed">{model.aplicabilidade}</p>
                    {model.descricao && <p className="mt-2 text-xs text-muted-foreground">{model.descricao}</p>}
                  </div>

                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div><span className="font-semibold">Arquivo:</span> {model.arquivoNomePadronizado}</div>
                    <div><span className="font-semibold">Formato:</span> {model.formato.toUpperCase()} {model.origem === "arquivo" ? `• ${formatBytes(model.arquivoTamanhoBytes)}` : "• link externo"}</div>
                    <div><span className="font-semibold">Professores:</span> {audience}</div>
                    <div><span className="font-semibold">Turmas:</span> {classLabels.join(", ")}</div>
                    <div><span className="font-semibold">Categoria:</span> {model.categoriaLabel}</div>
                    <div><span className="font-semibold">Atualizado:</span> {formatDate(model.atualizadoEm || model.criadoEm)}</div>
                  </div>

                  {isDirector && (
                    <div className="flex flex-wrap gap-1">
                      {(model.materiasSelecionadas || []).map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
                      {model.criterioTurmas === "selecionadas" && classLabels.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button size="sm" onClick={() => void downloadModel(model)} disabled={!model.ativo && !isDirector} className="gap-2">
                      <Download className="h-4 w-4" />
                      Baixar arquivo
                    </Button>
                    {isDirector && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(model)} className="gap-2"><Edit className="h-4 w-4" />Editar</Button>
                        <Button size="sm" variant="outline" onClick={() => void duplicateModel(model)} className="gap-2"><Copy className="h-4 w-4" />Duplicar</Button>
                        <Button size="sm" variant="destructive" onClick={() => void deleteModel(model)} className="gap-2"><Trash2 className="h-4 w-4" />Excluir</Button>
                        <span className="ml-auto text-xs text-muted-foreground">{downloadCounts.get(model.id) || 0} download(s) registrado(s)</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isDirector && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog(); }}>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar modelo base" : "Publicar novo modelo base"}</DialogTitle>
              <DialogDescription>Somente a Diretoria/Coordenação pode publicar, substituir, editar ou excluir estes modelos.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.categoriaId} onValueChange={updateCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{allCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo do modelo</Label>
                  <Select value={form.tipoId || undefined} onValueChange={updateType} disabled={selectedTypes.length === 0}>
                    <SelectTrigger><SelectValue placeholder={selectedTypes.length ? "Selecione o tipo" : "Nenhum tipo nesta categoria"} /></SelectTrigger>
                    <SelectContent>{selectedTypes.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {selectedTypes.length === 0 && <p className="text-xs text-muted-foreground">Crie um tipo para esta categoria em “Categorias e tipos”.</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Título da publicação</Label>
                <Input value={form.titulo} onChange={(event) => setForm((previous) => ({ ...previous, titulo: event.target.value }))} placeholder="Ex.: Prova bimestral padrão – Ensino Médio" />
              </div>

              <div className="space-y-2">
                <Label>Aplicabilidade / para qual situação usar</Label>
                <Textarea value={form.aplicabilidade} onChange={(event) => setForm((previous) => ({ ...previous, aplicabilidade: event.target.value }))} rows={3} placeholder="Explique quando o professor deve usar este modelo." />
              </div>

              <div className="space-y-2">
                <Label>Orientações adicionais</Label>
                <Textarea value={form.descricao} onChange={(event) => setForm((previous) => ({ ...previous, descricao: event.target.value }))} rows={2} placeholder="Ex.: Não alterar cabeçalho; preencher apenas campos destacados." />
              </div>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Arquivo do modelo</CardTitle><CardDescription>O nome final para download é gerado automaticamente com o tipo do modelo.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Button type="button" variant={form.origem === "arquivo" ? "default" : "outline"} onClick={() => setForm((previous) => ({ ...previous, origem: "arquivo" }))} className="gap-2"><UploadCloud className="h-4 w-4" />Arquivo pequeno no Firestore</Button>
                    <Button type="button" variant={form.origem === "link" ? "default" : "outline"} onClick={() => setForm((previous) => ({ ...previous, origem: "link" }))} className="gap-2"><Link2 className="h-4 w-4" />Link externo</Button>
                  </div>

                  {form.origem === "arquivo" ? (
                    <div className="space-y-2">
                      <Label>Selecionar arquivo (máximo 450 KB)</Label>
                      <Input type="file" accept=".pdf,.doc,.docx,.dotx,.xls,.xlsx,.xltx,.csv,.ppt,.pptx,.potx,.ppsx,.txt,.rtf,.odt,.ott,.ods,.ots,.odp,.otp,.png,.jpg,.jpeg,.svg,.zip" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
                      {uploadFile && <p className="text-xs text-muted-foreground">Selecionado: {uploadFile.name} • {formatBytes(uploadFile.size)}</p>}
                      {!uploadFile && editing?.arquivoNomeOriginal && <p className="text-xs text-muted-foreground">Arquivo atual: {editing.arquivoNomeOriginal}. Se não selecionar outro, ele será mantido.</p>}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                      <div className="space-y-2"><Label>Link externo</Label><Input value={form.linkExterno} onChange={(event) => setForm((previous) => ({ ...previous, linkExterno: event.target.value }))} placeholder="https://..." /></div>
                      <div className="space-y-2"><Label>Formato do arquivo/link</Label><Select value={form.formato} onValueChange={(value) => setForm((previous) => ({ ...previous, formato: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BASE_MODEL_FILE_FORMATS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Quem pode receber</CardTitle><CardDescription>O professor verá somente publicações liberadas para seu perfil.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Professores</Label>
                    <Select value={form.criterioProfessores} onValueChange={(value) => setForm((previous) => ({ ...previous, criterioProfessores: value as ProfessorCriterion }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os professores</SelectItem>
                        <SelectItem value="materias">Professores das matérias escolhidas</SelectItem>
                        <SelectItem value="selecionados">Professores específicos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.criterioProfessores === "materias" && (
                    <div className="space-y-2">
                      <Label>Matérias</Label>
                      <ScrollArea className="h-44 rounded-md border p-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {allSubjects.map((subject) => (
                            <label key={subject} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={form.materiasSelecionadas.includes(subject)} onCheckedChange={() => setForm((previous) => ({ ...previous, materiasSelecionadas: toggleValue(previous.materiasSelecionadas, subject) }))} />{subject}</label>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {form.criterioProfessores === "selecionados" && (
                    <div className="space-y-2">
                      <Label>Professores selecionados</Label>
                      <ScrollArea className="h-48 rounded-md border p-3">
                        <div className="space-y-2">
                          {activeProfessors.map((professor) => (
                            <label key={professor.uid} className="flex cursor-pointer items-start gap-2 text-sm"><Checkbox checked={form.professoresSelecionados.includes(professor.uid)} onCheckedChange={() => setForm((previous) => ({ ...previous, professoresSelecionados: toggleValue(previous.professoresSelecionados, professor.uid) }))} /><span><strong>{professor.nome}</strong><span className="block text-xs text-muted-foreground">{(professor.materias || []).join(", ") || "Sem matérias atribuídas"}</span></span></label>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Turmas de aplicação</Label>
                    <Select value={form.criterioTurmas} onValueChange={(value) => setForm((previous) => ({ ...previous, criterioTurmas: value as TurmaCriterion }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="todas">Todas as turmas</SelectItem><SelectItem value="selecionadas">Turmas escolhidas</SelectItem></SelectContent>
                    </Select>
                  </div>

                  {form.criterioTurmas === "selecionadas" && (
                    <ScrollArea className="h-40 rounded-md border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {activeClasses.map((item) => (
                          <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={form.turmasSelecionadas.includes(item.id)} onCheckedChange={() => setForm((previous) => ({ ...previous, turmasSelecionadas: toggleValue(previous.turmasSelecionadas, item.id) }))} />{item.nome}</label>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.ativo} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, ativo: Boolean(checked) }))} />Publicação ativa e disponível para os professores autorizados</label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => void saveModel()} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar nova versão" : "Publicar modelo"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isDirector && (
        <Dialog open={catalogDialogOpen} onOpenChange={(open) => {
          setCatalogDialogOpen(open);
          if (!open) {
            resetCategoryEditor();
            resetTypeEditor();
          }
        }}>
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar categorias e tipos de Modelos Base</DialogTitle>
              <DialogDescription>
                A Diretoria/Coordenação pode criar categorias e tipos próprios. Os itens padrão do sistema permanecem disponíveis e não podem ser apagados.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-2 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{editingCategoryId ? "Editar categoria personalizada" : "Nova categoria"}</CardTitle>
                  <CardDescription>Crie uma organização própria para os modelos da instituição.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da categoria</Label>
                    <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: Documentos do Ensino Médio" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => void saveCustomCategory()} disabled={savingCatalog}>{editingCategoryId ? "Salvar categoria" : "Criar categoria"}</Button>
                    {editingCategoryId && <Button variant="outline" onClick={resetCategoryEditor}>Cancelar edição</Button>}
                  </div>

                  <div className="border-t pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categorias personalizadas</p>
                    {(customCategories || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma categoria personalizada criada.</p>
                    ) : (
                      <div className="space-y-2">
                        {(customCategories || []).map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                            <span className="text-sm font-medium">{item.label}</span>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => editCustomCategory(item)} title="Editar categoria"><Edit className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => void deleteCustomCategory(item)} title="Excluir categoria"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{editingTypeId ? "Editar tipo personalizado" : "Novo tipo de modelo"}</CardTitle>
                  <CardDescription>Defina o nome do tipo e explique quando ele deve ser utilizado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={typeCategoryId} onValueChange={setTypeCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                      <SelectContent>{allCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do tipo</Label>
                    <Input value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Ex.: Cabeçalho de atividade prática" />
                  </div>
                  <div className="space-y-2">
                    <Label>Aplicabilidade / quando usar</Label>
                    <Textarea value={typeApplicability} onChange={(event) => setTypeApplicability(event.target.value)} rows={3} placeholder="Explique a situação em que este tipo deve ser utilizado." />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => void saveCustomType()} disabled={savingCatalog}>{editingTypeId ? "Salvar tipo" : "Criar tipo"}</Button>
                    {editingTypeId && <Button variant="outline" onClick={resetTypeEditor}>Cancelar edição</Button>}
                  </div>

                  <div className="border-t pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipos personalizados</p>
                    {(customTypes || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum tipo personalizado criado.</p>
                    ) : (
                      <div className="space-y-2">
                        {(customTypes || []).map((item) => (
                          <div key={item.id} className="rounded-md border p-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{getCategoryDefinition(item.categoryId)?.label || "Categoria personalizada"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{item.applicability}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => editCustomType(item)} title="Editar tipo"><Edit className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => void deleteCustomType(item)} title="Excluir tipo"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              O catálogo padrão possui {BASE_MODEL_CATEGORIES.length} categorias fixas e {BASE_MODEL_TYPES.length} tipos fixos. Categorias e tipos personalizados ficam salvos no Firestore e podem ser utilizados em novas publicações imediatamente.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCatalogDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
