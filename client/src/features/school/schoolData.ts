import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { downloadFileFromFirestore, FIRESTORE_FILE_MAX_BYTES, firestoreFileId, storeFileInFirestore, type FirestoreFileAccess } from "@/lib/firestoreFileStore";
import { SCHOOL_MODULE_BY_ID, type SchoolModuleDefinition, makeProtocol } from "./schoolCatalog";
import {
  applyCapabilityAutomations,
  capabilityIdentifier,
  validateCapabilityData,
  type SchoolAutomationSummary,
} from "./schoolCapabilityEngine";

export interface SchoolAttachment {
  name: string;
  url: string;
  storagePath?: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface SchoolRecordVersion {
  at: string;
  by: string;
  byName: string;
  action: string;
  previousStatus?: string;
  snapshot: Record<string, unknown>;
}

export interface SchoolComment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  private: boolean;
}

export interface SchoolRecord {
  id: string;
  moduleId: string;
  moduleNumber: number;
  capabilityId: string;
  capabilityIndex: number;
  capability: string;
  workflow: string;
  title: string;
  code: string;
  status: string;
  description?: string;
  studentId?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  unitId?: string;
  unitName?: string;
  assigneeId?: string;
  assigneeName?: string;
  audienceUserIds: string[];
  audienceRoles: string[];
  customData: Record<string, string | number | boolean>;
  automation: SchoolAutomationSummary;
  attachments: SchoolAttachment[];
  comments?: SchoolComment[];
  versions?: SchoolRecordVersion[];
  sensitive: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByName?: string | null;
  retentionUntil?: string | null;
}

export interface SchoolActor {
  uid: string;
  name: string;
  role: string;
}

export interface SaveSchoolRecordInput {
  id?: string;
  moduleId: string;
  capability?: string;
  capabilityId?: string;
  capabilityIndex?: number;
  workflow: string;
  title: string;
  code?: string;
  status: string;
  description?: string;
  studentId?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  unitId?: string;
  unitName?: string;
  assigneeId?: string;
  assigneeName?: string;
  audienceUserIds?: string[];
  audienceRoles?: string[];
  customData?: Record<string, string | number | boolean>;
  automation?: SchoolAutomationSummary;
  attachments?: SchoolAttachment[];
}

const MAX_ATTACHMENT_SIZE = FIRESTORE_FILE_MAX_BYTES;
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4",
  "audio/mpeg",
  "audio/mp4",
];

function cleanValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanValue).filter((entry) => entry !== undefined) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, cleanValue(entry)]),
    ) as T;
  }
  return value;
}

function recordSnapshot(record: Partial<SchoolRecord>): Record<string, unknown> {
  return cleanValue({
    capabilityId: record.capabilityId,
    capabilityIndex: record.capabilityIndex,
    capability: record.capability,
    workflow: record.workflow,
    title: record.title,
    code: record.code,
    status: record.status,
    description: record.description,
    studentId: record.studentId,
    studentName: record.studentName,
    classId: record.classId,
    className: record.className,
    unitId: record.unitId,
    unitName: record.unitName,
    assigneeId: record.assigneeId,
    assigneeName: record.assigneeName,
    customData: record.customData,
    automation: record.automation,
    attachments: record.attachments,
    deletedAt: record.deletedAt,
  });
}

export function validateSchoolRecord(input: SaveSchoolRecordInput, module: SchoolModuleDefinition): string[] {
  const errors: string[] = [];
  const capability = input.capability || module.capabilities[0];
  if (!input.title.trim()) errors.push("Informe um título.");
  if (!capability) errors.push("Selecione a funcionalidade executada.");
  if (!input.workflow) errors.push("Selecione o processo.");
  if (!input.status) errors.push("Selecione o status.");

  for (const definition of module.fields.filter((item) => item.required)) {
    const value = input.customData?.[definition.key];
    if (value === undefined || value === null || String(value).trim() === "") {
      errors.push(`Preencha o campo obrigatório: ${definition.label}.`);
    }
  }

  const data = input.customData || {};
  const numericRanges: Record<string, [number, number]> = {
    frequenciaMinima: [0, 100],
    percentual: [0, 100],
    pontuacao: [0, 10000],
    nota: [0, 10],
    avaliacao: [1, 5],
  };
  for (const [key, [min, max]] of Object.entries(numericRanges)) {
    if (data[key] === undefined || data[key] === "") continue;
    const number = Number(data[key]);
    if (!Number.isFinite(number) || number < min || number > max) {
      errors.push(`${key === "nota" ? "Nota" : "Valor"} deve ficar entre ${min} e ${max}.`);
    }
  }

  const start = String(data.inicio || "");
  const end = String(data.fim || "");
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    errors.push("A data final deve ser posterior à data inicial.");
  }
  const amount = data.valor ?? data.custo;
  if (amount !== undefined && amount !== "" && Number(amount) < 0) {
    errors.push("Valores financeiros não podem ser negativos.");
  }
  errors.push(...validateCapabilityData(module, capability, data, input.status));
  return errors;
}

function auditPayload(
  action: string,
  recordId: string,
  moduleId: string,
  actor: SchoolActor,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  return cleanValue({
    action,
    recordId,
    moduleId,
    actorId: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    occurredAt: new Date().toISOString(),
    before,
    after,
    immutable: true,
  });
}

function notificationPayload(record: Partial<SchoolRecord>, actor: SchoolActor, userId: string) {
  return {
    userId,
    createdBy: actor.uid,
    title: `Atualização em ${SCHOOL_MODULE_BY_ID[record.moduleId || ""]?.shortTitle || "Gestão escolar"}`,
    message: `${actor.name} atualizou “${record.title || "registro"}”${record.capabilityId ? ` (${record.capabilityId})` : ""} para ${record.status || "novo status"}.`,
    moduleId: record.moduleId,
    recordId: record.id,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validationDocumentId(code: string): string {
  return code.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 180);
}

function maskHolderName(name?: string): string {
  if (!name) return "Titular não divulgado";
  return name.split(/\s+/).filter(Boolean).map((part, index, list) => index === 0 || index === list.length - 1 ? part : `${part[0]}.`).join(" ");
}

function normalizedDocument(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function activeRecord(record: SchoolRecord): boolean {
  return !record.deletedAt && !/cancelad|arquivad|inativ|revogad/.test(String(record.status).toLocaleLowerCase("pt-BR"));
}

const GUARDIAN_MODULE_PERMISSION: Record<string, string> = {
  responsaveis: "academic.view",
  matriculas: "academic.view",
  "calendario-horarios": "academic.view",
  frequencia: "attendance.view",
  atividades: "academic.view",
  avaliacoes: "academic.view",
  "notas-boletim": "academic.view",
  acompanhamento: "academic.view",
  conteudos: "academic.view",
  "aulas-ao-vivo": "academic.view",
  "documentos-escolares": "documents.sign",
  "portal-aluno": "academic.view",
  "portal-responsaveis": "academic.view",
  comunicacao: "communications.receive",
  "bem-estar": "discipline.view",
  financeiro: "finance.view",
  secretaria: "academic.view",
};

function guardianCanSeeModule(link: Record<string, unknown>, moduleId: string): boolean {
  const permissions = Array.isArray(link.permissions) ? link.permissions.map(String) : [];
  const required = GUARDIAN_MODULE_PERMISSION[moduleId];
  return Boolean(required && (permissions.includes("*") || permissions.includes(required)));
}

function timeValue(value: unknown): number {
  if (!value) return Number.NaN;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function recordsForModule(moduleId: string, actor?: SchoolActor): Promise<SchoolRecord[]> {
  const privileged = actor && ["diretor", "administrador"].includes(actor.role);
  const constraints = privileged || !actor
    ? [where("moduleId", "==", moduleId)]
    : [where("moduleId", "==", moduleId), where("audienceRoles", "array-contains", actor.role)];
  const snapshot = await getDocs(query(collection(db, "schoolRecords"), ...constraints));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as SchoolRecord);
}

async function validateCrossRecordRules(input: SaveSchoolRecordInput, actor: SchoolActor, current: SchoolRecord | null): Promise<void> {
  if (current && ["fechada", "bloqueada", "fechado", "homologado"].includes(current.status.toLocaleLowerCase("pt-BR")) && !["diretor", "administrador"].includes(actor.role)) {
    throw new Error("Este período está fechado. Somente a direção pode autorizar correção ou reabertura.");
  }

  if (input.moduleId === "calendario-horarios") {
    const start = timeValue(input.customData?.inicio);
    const end = timeValue(input.customData?.fim);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const candidates = (await recordsForModule(input.moduleId, actor)).filter((record) => record.id !== input.id && activeRecord(record));
      const conflict = candidates.find((record) => {
        const otherStart = timeValue(record.customData?.inicio);
        const otherEnd = timeValue(record.customData?.fim);
        if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd) || start >= otherEnd || end <= otherStart) return false;
        const sameTeacher = Boolean(input.customData?.professor) && input.customData?.professor === record.customData?.professor;
        const sameRoom = Boolean(input.customData?.sala) && input.customData?.sala === record.customData?.sala;
        const sameClass = Boolean(input.customData?.turma || input.classId) && (input.customData?.turma === record.customData?.turma || input.classId === record.classId);
        return sameTeacher || sameRoom || sameClass;
      });
      if (conflict) throw new Error(`Conflito de horário com ${conflict.code} — ${conflict.title}. Revise professor, sala ou turma.`);
    }
  }

  if (input.moduleId === "matriculas" || input.moduleId === "alunos") {
    const cpf = normalizedDocument(input.customData?.candidatoCpf || input.customData?.cpf);
    if (cpf.length === 11) {
      const modules = await Promise.all([recordsForModule("matriculas", actor), recordsForModule("alunos", actor)]);
      const duplicate = modules.flat().find((record) => record.id !== input.id && activeRecord(record) && normalizedDocument(record.customData?.candidatoCpf || record.customData?.cpf) === cpf);
      if (duplicate) throw new Error(`Possível aluno duplicado: o CPF já aparece em ${duplicate.code} — ${duplicate.title}.`);
    }
  }

  if (input.moduleId === "matriculas" && /matriculad|definitiv|aprovad/.test(input.status.toLocaleLowerCase("pt-BR")) && input.classId) {
    const classSnapshot = await getDoc(doc(db, "turmas", input.classId));
    if (classSnapshot.exists()) {
      const classData = classSnapshot.data();
      const capacity = Number(classData.vagasTotais || 0);
      const occupied = Number(classData.vagasPreenchidas || 0);
      if (capacity > 0 && occupied >= capacity) throw new Error("A turma selecionada atingiu a capacidade máxima. Use a lista de espera ou escolha outra turma.");
    }
  }
}

export async function saveSchoolRecord(input: SaveSchoolRecordInput, actor: SchoolActor): Promise<SchoolRecord> {
  const module = SCHOOL_MODULE_BY_ID[input.moduleId];
  if (!module) throw new Error("Módulo escolar inválido.");
  const capability = input.capability && module.capabilities.includes(input.capability) ? input.capability : module.capabilities[0];
  const normalizedInput = { ...input, capability };
  const errors = validateSchoolRecord(normalizedInput, module);
  if (errors.length) throw new Error(errors.join("\n"));

  const now = new Date().toISOString();
  const recordRef = input.id ? doc(db, "schoolRecords", input.id) : doc(collection(db, "schoolRecords"));
  const currentSnapshot = input.id ? await getDoc(recordRef) : null;
  const current = currentSnapshot?.exists() ? ({ id: currentSnapshot.id, ...currentSnapshot.data() } as SchoolRecord) : null;
  await validateCrossRecordRules(normalizedInput, actor, current);
  const guardianLinkSnapshot = input.studentId && actor.role !== "responsavel"
    ? await getDocs(query(collection(db, "guardianLinks"), where("studentId", "==", input.studentId), where("active", "==", true)))
    : null;
  const guardianLinks = guardianLinkSnapshot?.docs.map((entry) => entry.data() as Record<string, unknown>) || [];
  const guardianAudienceIds = guardianLinks.filter((link) => guardianCanSeeModule(link, input.moduleId)).map((link) => String(link.guardianId || "")).filter(Boolean);
  const audienceUserIds = Array.from(new Set([actor.uid, ...(input.audienceUserIds || []), input.studentId, input.assigneeId, ...guardianAudienceIds].filter(Boolean) as string[]));
  const institutionalRoles = ["diretor", "administrador", "secretaria", "coordenador", "financeiro", "bibliotecario", "psicologo", "inspetor", "funcionario", "rh", "cantina", "transporte"];
  const operationalRoles: Record<string, string[]> = {
    "alunos": ["diretor", "administrador", "secretaria", "coordenador"],
    "matriculas": ["diretor", "administrador", "secretaria", "coordenador", "financeiro"],
    "calendario-horarios": ["diretor", "administrador", "secretaria", "coordenador", "professor", "professor_substituto", "monitor"],
    "frequencia": ["diretor", "administrador", "secretaria", "coordenador"],
    "notas-boletim": ["diretor", "administrador", "coordenador"],
    "acompanhamento": ["diretor", "administrador", "coordenador"],
  };
  const audienceRoles = Array.from(new Set([
    ...(input.audienceRoles || []),
    ...(operationalRoles[input.moduleId] || []),
    ...(institutionalRoles.includes(actor.role) ? [actor.role] : []),
  ]));
  const nextVersion: SchoolRecordVersion | null = current
    ? {
        at: now,
        by: actor.uid,
        byName: actor.name,
        action: "atualização",
        previousStatus: current.status,
        snapshot: recordSnapshot(current),
      }
    : null;

  const processed = applyCapabilityAutomations(module, capability, input.customData || {}, input.status, now);
  const capabilityIndex = module.capabilities.indexOf(capability);

  const record: SchoolRecord = cleanValue({
    id: recordRef.id,
    moduleId: input.moduleId,
    moduleNumber: module.number,
    capabilityId: capabilityIdentifier(module, capabilityIndex),
    capabilityIndex,
    capability,
    workflow: input.workflow,
    title: input.title.trim(),
    code: input.code?.trim() || current?.code || makeProtocol(module.number),
    status: input.status,
    description: input.description?.trim() || "",
    studentId: input.studentId || "",
    studentName: input.studentName?.trim() || "",
    classId: input.classId || "",
    className: input.className?.trim() || "",
    unitId: input.unitId || "",
    unitName: input.unitName?.trim() || "",
    assigneeId: input.assigneeId || "",
    assigneeName: input.assigneeName?.trim() || "",
    audienceUserIds,
    audienceRoles,
    customData: processed.customData,
    automation: processed.automation,
    attachments: input.attachments || current?.attachments || [],
    comments: current?.comments || [],
    versions: nextVersion ? [...(current?.versions || []).slice(-49), nextVersion] : current?.versions || [],
    sensitive: Boolean(module.restricted),
    createdAt: current?.createdAt || now,
    createdBy: current?.createdBy || actor.uid,
    createdByName: current?.createdByName || actor.name,
    updatedAt: now,
    updatedBy: actor.uid,
    updatedByName: actor.name,
    deletedAt: current?.deletedAt || null,
    deletedBy: current?.deletedBy || null,
    deletedByName: current?.deletedByName || null,
    retentionUntil: current?.retentionUntil || null,
  });

  const gradeForRisk = Number(record.customData.mediaCalculada ?? record.customData.nota);
  const minimumGrade = Number(record.customData.mediaMinima || 6);
  if (record.moduleId === "notas-boletim" && Number.isFinite(gradeForRisk) && gradeForRisk < minimumGrade) {
    record.customData.riscoAutomatico = gradeForRisk < minimumGrade * 0.66 ? "Crítico" : "Alto";
    record.customData.riscoDetectadoEm = now;
  }

  const batch = writeBatch(db);
  batch.set(recordRef, record, { merge: false });
  const auditRef = doc(collection(db, "schoolAuditLogs"));
  batch.set(auditRef, auditPayload(current ? "update" : "create", record.id, record.moduleId, actor, current ? recordSnapshot(current) : null, recordSnapshot(record)));
  for (const userId of audienceUserIds.filter((id) => id !== actor.uid).slice(0, 20)) {
    batch.set(doc(collection(db, "schoolNotifications")), notificationPayload(record, actor, userId));
  }
  const alertPercentage = Number(record.customData.percentual);
  const alertGrade = Number(record.customData.mediaCalculada ?? record.customData.nota);
  const minimumFrequency = Number(record.customData.frequenciaMinima || 75);
  const alertMinimumGrade = Number(record.customData.mediaMinima || 6);
  if (record.studentId && ((record.moduleId === "frequencia" && Number.isFinite(alertPercentage) && alertPercentage < minimumFrequency) || (record.moduleId === "notas-boletim" && Number.isFinite(alertGrade) && alertGrade < alertMinimumGrade))) {
    for (const link of guardianLinks.slice(0, 10)) {
      const guardianId = String(link.guardianId || "");
      if (!guardianId) continue;
      batch.set(doc(collection(db, "schoolNotifications")), {
        userId: guardianId,
        createdBy: actor.uid,
        title: record.moduleId === "frequencia" ? "Alerta de frequência" : "Alerta de rendimento",
        message: record.moduleId === "frequencia" ? `${record.studentName || "O estudante"} está com ${alertPercentage.toFixed(1)}% de frequência.` : `${record.studentName || "O estudante"} recebeu nota ${alertGrade.toFixed(1)} em ${String(record.customData.disciplina || "uma disciplina")}.`,
        moduleId: record.moduleId,
        recordId: record.id,
        read: false,
        priority: "high",
        createdAt: now,
      });
    }
  }
  if (record.moduleId === "documentos-escolares" && /emitid|cancelad|arquivad/.test(record.status.toLowerCase())) {
    const documentHash = await sha256(JSON.stringify({ code: record.code, workflow: record.workflow, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt }));
    batch.set(doc(db, "schoolDocumentValidations", validationDocumentId(record.code)), {
      code: record.code,
      documentType: record.workflow,
      holder: maskHolderName(record.studentName),
      status: record.status,
      valid: !/cancelad/.test(record.status.toLowerCase()),
      issuedAt: record.customData.emissao || record.updatedAt,
      institution: "Vestibulando",
      integrityHash: documentHash,
      updatedAt: record.updatedAt,
    }, { merge: true });
  }
  await batch.commit();
  return record;
}

export async function changeSchoolRecordStatus(record: SchoolRecord, status: string, actor: SchoolActor): Promise<void> {
  await saveSchoolRecord({
    ...record,
    id: record.id,
    status,
    customData: record.customData,
    audienceUserIds: record.audienceUserIds,
    audienceRoles: record.audienceRoles,
    attachments: record.attachments,
  }, actor);
}

export async function softDeleteSchoolRecord(record: SchoolRecord, actor: SchoolActor, retentionDays = 90): Promise<void> {
  const now = new Date();
  const retention = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const recordRef = doc(db, "schoolRecords", record.id);
  const batch = writeBatch(db);
  batch.update(recordRef, {
    deletedAt: now.toISOString(),
    deletedBy: actor.uid,
    deletedByName: actor.name,
    retentionUntil: retention,
    updatedAt: now.toISOString(),
    updatedBy: actor.uid,
    updatedByName: actor.name,
  });
  batch.set(doc(collection(db, "schoolAuditLogs")), auditPayload("soft_delete", record.id, record.moduleId, actor, recordSnapshot(record), { ...recordSnapshot(record), deletedAt: now.toISOString(), retentionUntil: retention }));
  await batch.commit();
}

export async function restoreSchoolRecord(record: SchoolRecord, actor: SchoolActor): Promise<void> {
  const now = new Date().toISOString();
  const recordRef = doc(db, "schoolRecords", record.id);
  const batch = writeBatch(db);
  batch.update(recordRef, {
    deletedAt: null,
    deletedBy: null,
    deletedByName: null,
    retentionUntil: null,
    updatedAt: now,
    updatedBy: actor.uid,
    updatedByName: actor.name,
  });
  batch.set(doc(collection(db, "schoolAuditLogs")), auditPayload("restore", record.id, record.moduleId, actor, recordSnapshot(record), { ...recordSnapshot(record), deletedAt: null }));
  await batch.commit();
}

export async function addSchoolRecordComment(record: SchoolRecord, text: string, actor: SchoolActor, isPrivate: boolean): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Escreva um comentário antes de salvar.");
  const comment: SchoolComment = {
    id: `${Date.now()}-${actor.uid}`,
    text: trimmed,
    createdAt: new Date().toISOString(),
    createdBy: actor.uid,
    createdByName: actor.name,
    private: isPrivate,
  };
  if (isPrivate) {
    await addDoc(collection(db, "schoolPrivateNotes"), {
      ...comment,
      recordId: record.id,
      moduleId: record.moduleId,
      allowedUserIds: [actor.uid, record.assigneeId].filter(Boolean),
    });
  } else {
    await updateDoc(doc(db, "schoolRecords", record.id), {
      comments: arrayUnion(comment),
      updatedAt: comment.createdAt,
      updatedBy: actor.uid,
      updatedByName: actor.name,
    });
  }
  await addDoc(collection(db, "schoolAuditLogs"), auditPayload("comment", record.id, record.moduleId, actor, null, { private: isPrivate, commentId: comment.id }));
}

export async function uploadSchoolAttachment(file: File, moduleId: string, actor: SchoolActor, access: Partial<FirestoreFileAccess> = {}): Promise<SchoolAttachment> {
  if (file.size > MAX_ATTACHMENT_SIZE) throw new Error("No modo gratuito, o arquivo pode ter no máximo 8 MB.");
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) throw new Error("Formato de arquivo não permitido.");
  const stored = await storeFileInFirestore(file, {
    ...access,
    ownerId: actor.uid,
    ownerRole: actor.role,
    audienceUserIds: [actor.uid, ...(access.audienceUserIds || [])],
    audienceRoles: ["diretor", "administrador", ...(access.audienceRoles || [])],
    purpose: `school-record:${moduleId}`,
  });
  return {
    name: file.name,
    url: stored.url,
    storagePath: stored.reference,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: actor.uid,
  };
}

export async function downloadSchoolAttachment(attachment: SchoolAttachment): Promise<void> {
  const firestoreReference = attachment.storagePath && firestoreFileId(attachment.storagePath)
    ? attachment.storagePath
    : attachment.url && firestoreFileId(attachment.url) ? attachment.url : "";
  if (firestoreReference) {
    await downloadFileFromFirestore(firestoreReference, attachment.name);
    return;
  }
  if (!attachment.url) throw new Error("O arquivo não possui uma referência válida.");
  const anchor = document.createElement("a");
  anchor.href = attachment.url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
}

export function downloadFile(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportRecordsCsv(records: SchoolRecord[]): string {
  const headers = ["Módulo", "Requisito", "Funcionalidade", "Processo", "Código", "Título", "Status", "Aluno", "Turma", "Unidade", "Responsável", "Criado em", "Atualizado em", "Dados adicionais", "Automação"];
  const rows = records.map((record) => [record.moduleId, record.capabilityId, record.capability, record.workflow, record.code, record.title, record.status, record.studentName, record.className, record.unitName, record.assigneeName, record.createdAt, record.updatedAt, record.customData, record.automation]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

function parseDelimited(text: string): string[][] {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g)?.length || 0) >= (text.split(/\r?\n/, 1)[0].match(/,/g)?.length || 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ""; continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export interface SchoolCsvImportResult { imported: number; failed: number; errors: string[] }

export async function importSchoolCsv(file: File, moduleId: string, actor: SchoolActor, onProgress?: (current: number, total: number) => void): Promise<SchoolCsvImportResult> {
  const module = SCHOOL_MODULE_BY_ID[moduleId];
  if (!module) throw new Error("Selecione um módulo válido para a importação.");
  if (file.size > 5 * 1024 * 1024) throw new Error("O CSV ultrapassa o limite de 5 MB.");
  const rows = parseDelimited((await file.text()).replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("O arquivo deve conter cabeçalho e pelo menos uma linha de dados.");
  if (rows.length > 2001) throw new Error("Importe no máximo 2.000 linhas por arquivo.");
  const headers = rows[0].map((header) => header.trim());
  const required = ["titulo", "processo", "status"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}.`);
  const result: SchoolCsvImportResult = { imported: 0, failed: 0, errors: [] };
  for (let index = 1; index < rows.length; index += 1) {
    const values = Object.fromEntries(headers.map((header, column) => [header, rows[index][column] || ""]));
    const customData = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith("data.")).map(([key, value]) => [key.slice(5), value]));
    try {
      await saveSchoolRecord({ moduleId, capability: values.funcionalidade || module.capabilities[0], workflow: values.processo, title: values.titulo, status: values.status, code: values.codigo, description: values.descricao, studentId: values.alunoId, studentName: values.aluno, classId: values.turmaId, className: values.turma, unitId: values.unidadeId, unitName: values.unidade, assigneeId: values.responsavelId, assigneeName: values.responsavel, customData }, actor);
      result.imported += 1;
    } catch (error: any) {
      result.failed += 1;
      if (result.errors.length < 20) result.errors.push(`Linha ${index + 1}: ${error.message}`);
    }
    onProgress?.(index, rows.length - 1);
  }
  await registerAuditEvent("csv_import", "integracoes", actor, { moduleId, fileName: file.name, imported: result.imported, failed: result.failed });
  return result;
}

export function schoolCsvTemplate(module: SchoolModuleDefinition): string {
  const headers = ["funcionalidade", "titulo", "processo", "status", "codigo", "descricao", "alunoId", "aluno", "turmaId", "turma", "unidadeId", "unidade", "responsavelId", "responsavel", ...module.fields.map((item) => `data.${item.key}`)];
  const sample = [module.capabilities[0], `Exemplo de ${module.shortTitle}`, module.workflows[0], module.statuses[0], "", "Linha de exemplo; apague antes de importar", "", "", "", "", "", "", "", "", ...module.fields.map(() => "")];
  return `\uFEFF${[headers, sample].map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

export function exportEducacensoCsv(records: SchoolRecord[]): string {
  const eligible = records.filter((record) => !record.deletedAt && ["alunos", "matriculas", "estrutura-academica", "inclusao", "notas-boletim", "frequencia"].includes(record.moduleId));
  const headers = ["tipo_registro", "codigo", "aluno_id", "nome", "cpf", "nascimento", "turma_id", "turma", "etapa_modalidade", "necessidade_especial", "situacao_movimento", "frequencia", "resultado"];
  const rows = eligible.map((record) => [record.moduleId, record.code, record.studentId, record.studentName || record.customData.aluno, record.customData.cpf || record.customData.candidatoCpf, record.customData.dataNascimento, record.classId, record.className || record.customData.turma, record.customData.modalidade || record.customData.nivel, record.customData.tipoNecessidade || record.customData.acessibilidade, record.status, record.customData.percentual, record.customData.resultado]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

export function createSchoolBackup(records: SchoolRecord[], auditLogs: unknown[] = []) {
  return {
    format: "vestibulando-school-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    totals: { records: records.length, auditLogs: auditLogs.length },
    records,
    auditLogs,
  };
}

export async function importSchoolBackup(
  payload: unknown,
  actor: SchoolActor,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  if (!payload || typeof payload !== "object") throw new Error("Arquivo de backup inválido.");
  const backup = payload as { format?: string; version?: number; records?: SchoolRecord[] };
  if (backup.format !== "vestibulando-school-backup" || backup.version !== 1 || !Array.isArray(backup.records)) {
    throw new Error("Este arquivo não é um backup compatível do Vestibulando.");
  }
  if (backup.records.length > 10_000) throw new Error("O backup ultrapassa o limite de 10.000 registros por importação.");

  let restored = 0;
  for (let offset = 0; offset < backup.records.length; offset += 350) {
    const chunk = backup.records.slice(offset, offset + 350);
    const batch = writeBatch(db);
    for (const oldRecord of chunk) {
      if (!oldRecord.id || !SCHOOL_MODULE_BY_ID[oldRecord.moduleId]) continue;
      const now = new Date().toISOString();
      const module = SCHOOL_MODULE_BY_ID[oldRecord.moduleId];
      const capability = oldRecord.capability && module.capabilities.includes(oldRecord.capability)
        ? oldRecord.capability
        : module.capabilities[oldRecord.capabilityIndex] || module.capabilities[0];
      const capabilityIndex = module.capabilities.indexOf(capability);
      const processed = applyCapabilityAutomations(module, capability, oldRecord.customData || {}, oldRecord.status, now);
      const record = cleanValue({
        ...oldRecord,
        capability,
        capabilityId: capabilityIdentifier(module, capabilityIndex),
        capabilityIndex,
        customData: processed.customData,
        automation: processed.automation,
        updatedAt: now,
        updatedBy: actor.uid,
        updatedByName: actor.name,
        restoredFromBackupAt: now,
        restoredFromBackupBy: actor.uid,
      });
      batch.set(doc(db, "schoolRecords", oldRecord.id), record, { merge: false });
      restored += 1;
    }
    batch.set(doc(collection(db, "schoolAuditLogs")), auditPayload("backup_restore_batch", `batch-${offset}`, "continuidade", actor, null, { count: chunk.length }));
    await batch.commit();
    onProgress?.(Math.min(offset + chunk.length, backup.records.length), backup.records.length);
  }
  return restored;
}

export async function registerAuditEvent(action: string, moduleId: string, actor: SchoolActor, details: Record<string, unknown>): Promise<void> {
  await setDoc(doc(collection(db, "schoolAuditLogs")), auditPayload(action, String(details.recordId || "system"), moduleId, actor, null, details));
}
