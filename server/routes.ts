import type { Express, Request, RequestHandler, Response } from "express";
import { createServer, type Server } from "http";
import admin from "firebase-admin";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve } from "path";

let firebaseAdmin: admin.app.App | null = null;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const requestWindows = new Map<string, { count: number; resetAt: number }>();
const integrationProviders = ["email", "push", "whatsapp", "pix", "bank", "invoice", "signature", "videoconference", "google-calendar", "microsoft-calendar"] as const;
type IntegrationProvider = typeof integrationProviders[number];

function integrationEnvPrefix(provider: IntegrationProvider): string {
  return provider.toUpperCase().replace(/-/g, "_");
}

function integrationConfiguration(provider: IntegrationProvider) {
  const prefix = integrationEnvPrefix(provider);
  const endpoint = String(process.env[`INTEGRATION_${prefix}_ENDPOINT`] || "").trim();
  const token = String(process.env[`INTEGRATION_${prefix}_TOKEN`] || "").trim();
  return { provider, endpoint, token, configured: /^https:\/\//i.test(endpoint) && token.length >= 8 };
}

function integrationCatalog() {
  return integrationProviders.map((provider) => {
    const configuration = integrationConfiguration(provider);
    return { provider, configured: configuration.configured, transport: "https-json", queue: true };
  });
}

function notificationAvailableAt(preferences: Record<string, unknown>, now = new Date()): string {
  const parseMinutes = (value: unknown, fallback: number) => {
    const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
    return match ? Math.min(1_439, Number(match[1]) * 60 + Number(match[2])) : fallback;
  };
  const start = parseMinutes(preferences.quietStart, 22 * 60);
  const end = parseMinutes(preferences.quietEnd, 7 * 60);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const current = hour * 60 + minute;
  const insideQuiet = start <= end ? current >= start && current < end : current >= start || current < end;
  if (!insideQuiet) return now.toISOString();
  const waitMinutes = start <= end || current < end ? end - current : 1_440 - current + end;
  return new Date(now.getTime() + Math.max(1, waitMinutes) * 60_000).toISOString();
}

async function dispatchIntegration(provider: IntegrationProvider, operation: string, payload: unknown, idempotencyKey: string) {
  const configuration = integrationConfiguration(provider);
  if (!configuration.configured) throw new Error(`Conector ${provider} não configurado no ambiente.`);
  const response = await fetch(configuration.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "X-Vestibulando-Provider": provider,
      "X-Vestibulando-Operation": operation,
    },
    body: JSON.stringify({ provider, operation, payload, idempotencyKey, sentAt: new Date().toISOString() }),
    signal: AbortSignal.timeout(20_000),
  });
  const responseText = (await response.text()).slice(0, 8_000);
  if (!response.ok) throw new Error(`Provedor respondeu HTTP ${response.status}: ${responseText.slice(0, 500)}`);
  return { httpStatus: response.status, response: responseText, completedAt: new Date().toISOString() };
}

function allowRequest(req: Request, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  if (requestWindows.size > 10_000) {
    requestWindows.forEach((entry, entryKey) => { if (entry.resetAt <= now) requestWindows.delete(entryKey); });
  }
  const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${req.path}`;
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  if (current.count === limit + 1 && firebaseAdmin) {
    const ipHash = createHash("sha256").update(req.ip || req.socket.remoteAddress || "unknown").digest("hex");
    void firebaseAdmin.firestore().collection("securityAlerts").add({
      type: "rate_limit_exceeded", severity: "medium", status: "open", path: req.path,
      ipHash, attempts: current.count, windowEndsAt: new Date(current.resetAt).toISOString(), createdAt: new Date().toISOString(),
    }).catch((error) => console.error("Não foi possível registrar alerta de segurança:", error));
  }
  return current.count <= limit;
}

function enforceRateLimit(req: Request, res: Response, limit = 30): boolean {
  if (allowRequest(req, limit)) return true;
  res.status(429).json({ success: false, message: "Muitas tentativas. Aguarde um minuto e tente novamente." });
  return false;
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

function bearerToken(req: Request): string | null {
  const authorization = req.header("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

async function authenticatedUser(req: Request, res: Response): Promise<admin.auth.DecodedIdToken | null> {
  if (!firebaseAdmin) {
    res.status(503).json({ success: false, message: "Firebase Admin SDK não configurado" });
    return null;
  }
  const token = bearerToken(req) || (typeof req.body?.idToken === "string" ? req.body.idToken : null);
  if (!token) {
    res.status(401).json({ success: false, message: "Token de autenticação obrigatório" });
    return null;
  }
  try {
    return await firebaseAdmin.auth().verifyIdToken(token, true);
  } catch {
    res.status(401).json({ success: false, message: "Sessão inválida ou revogada" });
    return null;
  }
}

async function isAdministrativeUser(uid: string): Promise<boolean> {
  if (!firebaseAdmin) return false;
  const snapshot = await firebaseAdmin.firestore().collection("usuarios").doc(uid).get();
  if (!snapshot.exists) return false;
  const user = snapshot.data() || {};
  return user.tipo === "diretor" || user.papel === "administrador" || user.papelDetalhado === "administrador" || user.permissoes?.includes("*") || user.permissoes?.includes("acessos.manage");
}

async function hasServerPermission(uid: string, permission: string): Promise<boolean> {
  if (!firebaseAdmin) return false;
  const snapshot = await firebaseAdmin.firestore().collection("usuarios").doc(uid).get();
  if (!snapshot.exists) return false;
  const user = snapshot.data() || {};
  const permissions = Array.isArray(user.permissoes) ? user.permissoes : [];
  return user.tipo === "diretor" || user.papel === "administrador" || user.papelDetalhado === "administrador" || permissions.includes("*") || permissions.includes(permission);
}

function initializeFirebaseAdmin(): admin.app.App | null {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT não configurado - funcionalidades de admin desabilitadas");
      return null;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    
    if (admin.apps.length === 0) {
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin SDK inicializado com sucesso");
    } else {
      firebaseAdmin = admin.app();
    }
    
    return firebaseAdmin;
  } catch (error: any) {
    console.error("❌ Erro ao inicializar Firebase Admin SDK:", error.message);
    return null;
  }
}

function normalizeCpf(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function formattedCpf(value: unknown): string {
  const cpf = normalizeCpf(value);
  return cpf.length === 11 ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : cpf;
}

function isValidCpf(value: unknown): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function normalizeText(value: unknown): string {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function maskName(value: unknown): string {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return parts.map((part, index) => index === 0 ? part : `${part[0] || ""}.`).join(" ");
}

function publicFlowSecret(): string | null {
  const explicit = process.env.PUBLIC_FLOW_SECRET || process.env.CRON_SECRET || process.env.WEBHOOK_SECRET;
  if (explicit && explicit.length >= 24) return explicit;
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    return serviceAccount.private_key ? createHash("sha256").update(serviceAccount.private_key).digest("hex") : null;
  } catch {
    return null;
  }
}

function makeCorrectionToken(recordId: string): string | null {
  const secret = publicFlowSecret();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify({ recordId, exp: Date.now() + 15 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyCorrectionToken(token: unknown, expectedRecordId: string): boolean {
  const secret = publicFlowSecret();
  if (!secret || typeof token !== "string") return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.recordId === expectedRecordId && Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

async function findUserByIdentifier(identifier: string): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  if (!firebaseAdmin) return null;
  const users = firebaseAdmin.firestore().collection("usuarios");
  const raw = identifier.trim().toLowerCase();
  const digits = normalizeCpf(raw);
  let snapshot: FirebaseFirestore.QuerySnapshot;
  if (raw.includes("@")) snapshot = await users.where("email", "==", raw).limit(1).get();
  else if (digits.length === 11) {
    snapshot = await users.where("cpf", "==", formattedCpf(digits)).limit(1).get();
    if (snapshot.empty) snapshot = await users.where("cpf", "==", digits).limit(1).get();
  }
  else if (digits.length >= 4 && digits.length <= 20) snapshot = await users.where("matricula", "==", digits).limit(1).get();
  else return null;
  return snapshot.empty ? null : snapshot.docs[0];
}

async function findApplicationByEnrollment(enrollment: string): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  if (!firebaseAdmin) return null;
  const snapshot = await firebaseAdmin.firestore().collection("solicitacoes").where("matricula", "==", enrollment).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

async function exportCollectionFully(name: string): Promise<unknown[]> {
  if (!firebaseAdmin) return [];
  const rows: unknown[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  do {
    let collectionQuery: FirebaseFirestore.Query = firebaseAdmin.firestore().collection(name)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(1000);
    if (last) collectionQuery = collectionQuery.startAfter(last);
    const snapshot = await collectionQuery.get();
    rows.push(...snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    last = snapshot.empty ? null : snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 1000) break;
  } while (last);
  return rows;
}

const BACKUP_CHUNK_BYTES = 600 * 1024;

function firestoreBytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof (value as any).toUint8Array === "function") return Buffer.from((value as any).toUint8Array());
  throw new Error("Bloco de backup em formato inválido");
}

async function exportSchoolFileChunks(): Promise<unknown[]> {
  if (!firebaseAdmin) return [];
  const snapshot = await firebaseAdmin.firestore().collectionGroup("chunks").get();
  return snapshot.docs
    .filter((entry) => entry.ref.path.startsWith("schoolFiles/"))
    .map((entry) => ({ path: entry.ref.path, ...entry.data() }));
}

async function writeBackupChunks(backupRef: FirebaseFirestore.DocumentReference, compressed: Buffer): Promise<number> {
  if (!firebaseAdmin) return 0;
  const chunkCount = Math.ceil(compressed.length / BACKUP_CHUNK_BYTES);
  for (let groupStart = 0; groupStart < chunkCount; groupStart += 10) {
    const batch = firebaseAdmin.firestore().batch();
    const groupEnd = Math.min(chunkCount, groupStart + 10);
    for (let index = groupStart; index < groupEnd; index += 1) {
      const data = compressed.subarray(index * BACKUP_CHUNK_BYTES, Math.min(compressed.length, (index + 1) * BACKUP_CHUNK_BYTES));
      batch.set(backupRef.collection("chunks").doc(String(index).padStart(5, "0")), { index, byteLength: data.length, data });
    }
    await batch.commit();
  }
  return chunkCount;
}

async function readBackupChunks(backupRef: FirebaseFirestore.DocumentReference, expectedCount: number): Promise<Buffer> {
  const snapshot = await backupRef.collection("chunks").orderBy("index", "asc").get();
  if (snapshot.size !== expectedCount) throw new Error("Backup incompleto");
  return Buffer.concat(snapshot.docs.map((entry) => firestoreBytes(entry.data().data)));
}

async function deleteBackupDocument(backupRef: FirebaseFirestore.DocumentReference): Promise<void> {
  if (!firebaseAdmin) return;
  const chunks = await backupRef.collection("chunks").get();
  for (let offset = 0; offset < chunks.size; offset += 400) {
    const batch = firebaseAdmin.firestore().batch();
    chunks.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
  await backupRef.delete();
}

async function pruneSupersededBackups(preserveId: string): Promise<number> {
  if (!firebaseAdmin) return 0;
  const backups = await firebaseAdmin.firestore().collection("schoolBackups").orderBy("exportedAt", "desc").limit(50).get();
  const superseded = backups.docs.filter((entry) => entry.id !== preserveId);
  for (const entry of superseded) await deleteBackupDocument(entry.ref);
  return superseded.length;
}

export async function registerRoutes(expressApp: Express): Promise<Server> {
  
  initializeFirebaseAdmin();
  
  // Health check endpoint
  expressApp.get("/api/health", (req, res) => {
    const connectors = integrationCatalog();
    res.json({ status: "ok", service: "vestibulando-school-api", firebaseAdmin: Boolean(firebaseAdmin), connectorsConfigured: connectors.filter((item) => item.configured).length, connectorsTotal: connectors.length, timestamp: new Date().toISOString(), version: "3.0.0" });
  });

  expressApp.get("/api/openapi.json", (_req, res) => {
    const builtFile = resolve(process.cwd(), "dist/public/openapi.json");
    const sourceFile = resolve(process.cwd(), "client/public/openapi.json");
    res.sendFile(existsSync(builtFile) ? builtFile : sourceFile);
  });

  expressApp.post("/api/v1/public/auth/resolve", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 12)) return;
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Serviço de autenticação indisponível" });
    const identifier = String(req.body?.identifier || "").trim();
    if (identifier.length < 4 || identifier.length > 160) return res.status(400).json({ success: false, message: "Identificador inválido" });
    const userSnapshot = await findUserByIdentifier(identifier);
    if (userSnapshot) {
      const user = userSnapshot.data();
      return res.json({
        success: true,
        found: true,
        user: {
          id: userSnapshot.id,
          email: user.email,
          tipo: user.tipo || "funcionario",
          status: user.status || "aprovado",
          ativo: user.ativo !== false,
          bloqueado: user.bloqueado === true,
          suspensaoAtiva: user.suspensaoAtiva === true,
          suspensaoDataAplicacao: user.suspensaoDataAplicacao || null,
          suspensaoDataTermino: user.suspensaoDataTermino || null,
          suspensaoAplicadoPorNome: user.suspensaoAplicadoPorNome || null,
        },
      });
    }

    const digits = normalizeCpf(identifier);
    let applicationSnapshot: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    if (digits.length >= 4 && digits.length <= 20) {
      applicationSnapshot = await findApplicationByEnrollment(digits);
      if (!applicationSnapshot && digits.length === 11) {
        let byCpf = await firebaseAdmin.firestore().collection("solicitacoes").where("cpf", "==", formattedCpf(digits)).limit(1).get();
        if (byCpf.empty) byCpf = await firebaseAdmin.firestore().collection("solicitacoes").where("cpf", "==", digits).limit(1).get();
        applicationSnapshot = byCpf.empty ? null : byCpf.docs[0];
      }
    }
    const application = applicationSnapshot?.data();
    return res.json({
      success: true,
      found: false,
      application: application ? {
        status: application.status || "pendente",
        matricula: application.matricula,
        tipo: application.tipo || "aluno",
      } : null,
    });
  }));

  expressApp.post("/api/v1/public/auth/verify-recovery", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 5)) return;
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Serviço de autenticação indisponível" });
    const cpf = normalizeCpf(req.body?.cpf);
    const name = normalizeText(req.body?.name);
    const birthDate = String(req.body?.birthDate || "");
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isValidCpf(cpf) || name.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "Dados inválidos" });
    }
    let snapshot = await firebaseAdmin.firestore().collection("usuarios").where("cpf", "==", formattedCpf(cpf)).limit(1).get();
    if (snapshot.empty) snapshot = await firebaseAdmin.firestore().collection("usuarios").where("cpf", "==", cpf).limit(1).get();
    const data = snapshot.empty ? null : snapshot.docs[0].data();
    const verified = Boolean(data && normalizeText(data.nome) === name && data.dataNascimento === birthDate && String(data.email || "").toLowerCase() === email);
    if (!verified) return res.status(404).json({ success: false, message: "Os dados informados não conferem" });
    return res.json({ success: true, verified: true, email });
  }));

  expressApp.post("/api/v1/public/enrollment/status", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 10)) return;
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Serviço de matrícula indisponível" });
    const enrollment = normalizeCpf(req.body?.enrollment);
    if (enrollment.length < 4 || enrollment.length > 20) return res.status(400).json({ success: false, message: "Matrícula inválida" });
    const applicationSnapshot = await findApplicationByEnrollment(enrollment);
    if (applicationSnapshot) {
      const data = applicationSnapshot.data();
      return res.json({ success: true, found: true, result: { source: "application", matricula: data.matricula, nome: maskName(data.nome), status: data.status, tipo: data.tipo, turma: data.turma, dataSolicitacao: data.dataSolicitacao, verificationRequired: data.status === "devolvido" } });
    }
    const userSnapshot = await firebaseAdmin.firestore().collection("usuarios").where("matricula", "==", enrollment).limit(1).get();
    if (!userSnapshot.empty) {
      const data = userSnapshot.docs[0].data();
      return res.json({ success: true, found: true, result: { source: "user", matricula: data.matricula, nome: maskName(data.nome), status: data.status || "aprovado", tipo: data.tipo, turma: data.turma, ativo: data.ativo !== false } });
    }
    return res.json({ success: true, found: false });
  }));

  expressApp.post("/api/v1/public/enrollment/correction/verify", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 5)) return;
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Serviço de matrícula indisponível" });
    const enrollment = normalizeCpf(req.body?.enrollment);
    const cpf = normalizeCpf(req.body?.cpf);
    const birthDate = String(req.body?.birthDate || "");
    const snapshot = await findApplicationByEnrollment(enrollment);
    const data = snapshot?.data();
    const dateMatches = data?.dataNascimento === birthDate || (() => {
      const expected = new Date(`${data?.dataNascimento || "invalid"}T12:00:00Z`).getTime();
      const received = new Date(`${birthDate}T12:00:00Z`).getTime();
      return Number.isFinite(expected) && Number.isFinite(received) && Math.abs(expected - received) <= 86_400_000;
    })();
    if (!isValidCpf(cpf) || !snapshot || !data || normalizeCpf(data.cpf) !== cpf || !dateMatches || !["devolvido", "reprovado"].includes(data.status)) {
      return res.status(404).json({ success: false, message: "CPF ou data de nascimento não conferem" });
    }
    const correctionToken = makeCorrectionToken(snapshot.id);
    if (!correctionToken) return res.status(503).json({ success: false, message: "Segredo do fluxo público não configurado" });
    const allowedFields = ["nome", "email", "turma", "turmaId", "dataNascimento", "cpf", "sexo", "escolaridade", "telefone", "cep", "rua", "bairro", "cidade", "estado", "disponibilidade", "horarioEspecialObservacao", "fotoBase64", "fotoPublica"];
    const application = Object.fromEntries(allowedFields.map((field) => [field, data[field] ?? null]));
    return res.json({ success: true, id: snapshot.id, correctionToken, application });
  }));

  expressApp.post("/api/v1/public/enrollment/correction/:recordId", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 6)) return;
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Serviço de matrícula indisponível" });
    const recordId = String(req.params.recordId || "");
    if (!verifyCorrectionToken(req.body?.correctionToken, recordId)) return res.status(401).json({ success: false, message: "Autorização de correção inválida ou expirada" });
    const recordRef = firebaseAdmin.firestore().collection("solicitacoes").doc(recordId);
    const snapshot = await recordRef.get();
    if (!snapshot.exists || !["devolvido", "reprovado"].includes(snapshot.data()?.status)) return res.status(409).json({ success: false, message: "Esta solicitação não está disponível para correção" });
    const input = req.body?.application || {};
    const required = ["nome", "email", "turma", "turmaId", "dataNascimento", "cpf", "sexo", "escolaridade", "telefone", "cep", "rua", "bairro", "cidade", "estado", "disponibilidade"];
    if (required.some((field) => input[field] === undefined || input[field] === null || input[field] === "") || !Array.isArray(input.disponibilidade)) return res.status(400).json({ success: false, message: "Preencha todos os campos obrigatórios" });
    const update = {
      nome: String(input.nome).trim().slice(0, 180), email: String(input.email).trim().toLowerCase().slice(0, 180),
      turma: String(input.turma).slice(0, 160), turmaId: String(input.turmaId).slice(0, 160), dataNascimento: String(input.dataNascimento).slice(0, 10),
      cpf: formattedCpf(input.cpf), sexo: String(input.sexo).slice(0, 80), escolaridade: String(input.escolaridade).slice(0, 160), telefone: String(input.telefone).slice(0, 40),
      cep: String(input.cep).slice(0, 20), rua: String(input.rua).slice(0, 180), bairro: String(input.bairro).slice(0, 120), cidade: String(input.cidade).slice(0, 120), estado: String(input.estado).slice(0, 40),
      disponibilidade: input.disponibilidade.map((item: unknown) => String(item).slice(0, 100)).slice(0, 30), horarioEspecialObservacao: input.horarioEspecialObservacao ? String(input.horarioEspecialObservacao).slice(0, 1000) : null,
      fotoBase64: typeof input.fotoBase64 === "string" && input.fotoBase64.length <= 1_500_000 ? input.fotoBase64 : null, fotoPublica: input.fotoPublica === true,
      status: "pendente", dataSolicitacao: new Date().toISOString(), comentarioReprovacao: null, dataReprovacao: null, comentarioDevolucao: null, dataDevolucao: null,
    };
    await recordRef.update(update);
    await firebaseAdmin.firestore().collection("schoolAuditLogs").add({ action: "enrollment_correction_submit", recordId, moduleId: "matriculas", actorId: "public-self-service", actorName: "Autoatendimento verificado", actorRole: "candidato", occurredAt: new Date().toISOString(), before: { status: snapshot.data()?.status }, after: { status: "pendente" }, immutable: true });
    return res.json({ success: true, matricula: snapshot.data()?.matricula });
  }));

  expressApp.post("/api/v1/public/enrollment/apply", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 5)) return;
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Serviço de matrícula indisponível" });
    const input = req.body?.application || {};
    const required = ["nome", "email", "turma", "turmaId", "dataNascimento", "cpf", "sexo", "escolaridade", "telefone", "cep", "rua", "bairro", "cidade", "estado", "disponibilidade"];
    if (required.some((field) => input[field] === undefined || input[field] === null || input[field] === "") || !Array.isArray(input.disponibilidade)) return res.status(400).json({ success: false, message: "Preencha todos os campos obrigatórios" });
    const cpf = normalizeCpf(input.cpf);
    const email = String(input.email).trim().toLowerCase();
    if (!isValidCpf(cpf) || !email.includes("@")) return res.status(400).json({ success: false, message: "CPF ou e-mail inválido" });
    const dbAdmin = firebaseAdmin.firestore();
    let duplicateUser = await dbAdmin.collection("usuarios").where("cpf", "==", formattedCpf(cpf)).limit(1).get();
    if (duplicateUser.empty) duplicateUser = await dbAdmin.collection("usuarios").where("cpf", "==", cpf).limit(1).get();
    let duplicateApplication = await dbAdmin.collection("solicitacoes").where("cpf", "==", formattedCpf(cpf)).limit(1).get();
    if (duplicateApplication.empty) duplicateApplication = await dbAdmin.collection("solicitacoes").where("cpf", "==", cpf).limit(1).get();
    if (!duplicateUser.empty || !duplicateApplication.empty) return res.status(409).json({ success: false, message: "Já existe cadastro ou solicitação para os dados informados" });
    const classSnapshot = await dbAdmin.collection("turmas").doc(String(input.turmaId)).get();
    if (!classSnapshot.exists || classSnapshot.data()?.ativa === false) return res.status(409).json({ success: false, message: "A turma selecionada não está disponível" });
    const classData = classSnapshot.data() || {};
    if (Number(classData.vagasTotais || 0) > 0 && Number(classData.vagasPreenchidas || 0) >= Number(classData.vagasTotais)) return res.status(409).json({ success: false, message: "A turma selecionada não possui vagas" });
    const applicationRef = dbAdmin.collection("solicitacoes").doc();
    const counterRef = dbAdmin.collection("system").doc("matriculaCounter");
    const lockRef = dbAdmin.collection("publicRegistrationLocks").doc(createHash("sha256").update(cpf).digest("hex"));
    const matricula = await dbAdmin.runTransaction(async (transaction) => {
      const [counterSnapshot, lockSnapshot] = await Promise.all([transaction.get(counterRef), transaction.get(lockRef)]);
      if (lockSnapshot.exists) throw new Error("duplicate_registration");
      const next = Number(counterSnapshot.data()?.ultimaMatricula || 99) + 1;
      const enrollment = String(next).padStart(4, "0");
      transaction.set(counterRef, { ultimaMatricula: next, atualizadoEm: new Date().toISOString() }, { merge: true });
      transaction.set(lockRef, { applicationId: applicationRef.id, createdAt: new Date().toISOString() });
      transaction.set(applicationRef, {
        nome: String(input.nome).trim().slice(0, 180), email, tipo: "aluno", turma: String(input.turma).slice(0, 160), turmaId: String(input.turmaId).slice(0, 160), status: "pendente", matricula: enrollment, dataSolicitacao: new Date().toISOString(),
        dataNascimento: String(input.dataNascimento).slice(0, 10), cpf: formattedCpf(cpf), sexo: String(input.sexo).slice(0, 80), escolaridade: String(input.escolaridade).slice(0, 160), telefone: String(input.telefone).slice(0, 40),
        cep: String(input.cep).slice(0, 20), rua: String(input.rua).slice(0, 180), bairro: String(input.bairro).slice(0, 120), cidade: String(input.cidade).slice(0, 120), estado: String(input.estado).slice(0, 40),
        disponibilidade: input.disponibilidade.map((item: unknown) => String(item).slice(0, 100)).slice(0, 30), horarioEspecialObservacao: input.horarioEspecialObservacao ? String(input.horarioEspecialObservacao).slice(0, 1000) : null,
        fotoBase64: typeof input.fotoBase64 === "string" && input.fotoBase64.length <= 1_500_000 ? input.fotoBase64 : null, fotoPublica: input.fotoPublica === true,
        requestFingerprint: createHash("sha256").update(`${req.ip || "unknown"}:${String(req.header("user-agent") || "")}`).digest("hex"),
      });
      return enrollment;
    }).catch((error: Error) => {
      if (error.message === "duplicate_registration") return null;
      throw error;
    });
    if (!matricula) return res.status(409).json({ success: false, message: "Já existe solicitação para os dados informados" });
    const oldRejections = await dbAdmin.collection("reprovacoes").where("email", "==", email).get();
    if (!oldRejections.empty) {
      const batch = dbAdmin.batch();
      oldRejections.docs.forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }
    return res.status(201).json({ success: true, matricula });
  }));

  expressApp.post("/api/v1/session/login", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 20)) return;
    const actor = await authenticatedUser(req, res);
    if (!actor || !firebaseAdmin) return;
    const profileSnapshot = await firebaseAdmin.firestore().collection("usuarios").doc(actor.uid).get();
    const profile = profileSnapshot.data() || {};
    await firebaseAdmin.firestore().collection("loginHistory").add({
      userId: actor.uid,
      userNome: profile.nome || actor.name || actor.email || actor.uid,
      userTipo: profile.tipo || "funcionario",
      action: "login",
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || req.socket.remoteAddress || "indisponível",
      userAgent: String(req.header("user-agent") || "indisponível").slice(0, 500),
      device: String(req.body?.device || "web").slice(0, 100),
      sessionId: String(req.body?.sessionId || "").slice(0, 100),
    });
    return res.json({ success: true });
  }));

  expressApp.post("/api/v1/session/logout", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 30)) return;
    const actor = await authenticatedUser(req, res);
    if (!actor || !firebaseAdmin) return;
    const profileSnapshot = await firebaseAdmin.firestore().collection("usuarios").doc(actor.uid).get();
    const profile = profileSnapshot.data() || {};
    await firebaseAdmin.firestore().collection("loginHistory").add({
      userId: actor.uid,
      userNome: profile.nome || actor.name || actor.email || actor.uid,
      userTipo: profile.tipo || "funcionario",
      action: "logout",
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || req.socket.remoteAddress || "indisponível",
      userAgent: String(req.header("user-agent") || "indisponível").slice(0, 500),
      device: String(req.body?.device || "web").slice(0, 100),
      sessionId: String(req.body?.sessionId || "").slice(0, 100),
      reason: String(req.body?.reason || "manual").slice(0, 100),
    });
    return res.json({ success: true });
  }));

  // Endpoint para atualizar senha no Firebase Authentication
  expressApp.post("/api/update-password", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, 10)) return;
      const actor = await authenticatedUser(req, res);
      if (!actor) return;
      const { userId, newPassword } = req.body;

      if (!userId || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: "ID do usuário e nova senha são obrigatórios" 
        });
      }

      if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return res.status(400).json({ 
          success: false, 
          message: "A senha deve ter 10 caracteres ou mais, incluindo letra maiúscula, minúscula e número" 
        });
      }

      if (!firebaseAdmin) {
        return res.status(503).json({ 
          success: false, 
          message: "Firebase Admin SDK não está configurado. Configure FIREBASE_SERVICE_ACCOUNT nos Secrets do Replit com as credenciais da conta de serviço." 
        });
      }

      const adminActor = await isAdministrativeUser(actor.uid);
      const isSelf = actor.uid === userId;
      const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(actor.auth_time || 0);
      if (!adminActor && !isSelf) return res.status(403).json({ success: false, message: "Sem permissão para alterar esta conta" });
      if (isSelf && !adminActor && authAgeSeconds > 600) return res.status(401).json({ success: false, message: "Entre novamente antes de alterar a senha" });

      try {
        await admin.auth().updateUser(userId, {
          password: newPassword,
        });

        await firebaseAdmin.firestore().collection("schoolAuditLogs").add({
          action: "password_update",
          recordId: userId,
          moduleId: "acessos",
          actorId: actor.uid,
          actorName: actor.email || actor.uid,
          actorRole: adminActor ? "administrador" : "self",
          occurredAt: new Date().toISOString(),
          before: null,
          after: { passwordStored: false, targetUserId: userId },
          immutable: true,
        });

        console.log(`✅ Senha atualizada com sucesso para UID: ${userId}`);
        return res.json({ 
          success: true, 
          message: "Senha atualizada com sucesso" 
        });
      } catch (adminError: any) {
        console.error(`❌ Erro ao atualizar senha:`, adminError.message);
        
        if (adminError.code === 'auth/user-not-found') {
          return res.status(404).json({ 
            success: false, 
            message: "Usuário não encontrado" 
          });
        }
        
        return res.status(400).json({ 
          success: false, 
          message: `Erro ao atualizar senha: ${adminError.message}` 
        });
      }

    } catch (error: any) {
      console.error("❌ Erro ao atualizar senha:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Erro interno ao atualizar senha" 
      });
    }
  });

  // Endpoint para marcar usuário como offline (usado com sendBeacon quando página fecha)
  expressApp.post("/api/user-offline/:userId", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, 30)) return;
      const actor = await authenticatedUser(req, res);
      if (!actor) return;
      const { userId } = req.params;

      if (!userId) {
        console.warn("⚠️ Tentativa de marcar offline sem userId");
        return res.status(400).json({ 
          success: false, 
          message: "ID do usuário é obrigatório" 
        });
      }

      if (actor.uid !== userId && !(await isAdministrativeUser(actor.uid))) {
        return res.status(403).json({ success: false, message: "Sem permissão para alterar esta presença" });
      }

      if (!firebaseAdmin) {
        console.warn(`⚠️ Firebase Admin não configurado - não foi possível marcar ${userId} como offline`);
        // Retorna 200 para não causar erro no cliente, mas indica que falhou
        return res.json({ 
          success: false, 
          reason: 'firebase_admin_not_configured',
          message: 'Firebase Admin SDK não configurado' 
        });
      }

      const db = firebaseAdmin.firestore();
      const userRef = db.collection('usuarios').doc(userId);

      await userRef.update({
        isOnline: false,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        statusPresenca: 'offline',
      });

      console.log(`✅ Usuário ${userId} marcado como offline`);
      return res.json({ success: true });
    } catch (error: any) {
      console.error(`❌ Erro ao marcar usuário ${req.params.userId} offline:`, error.message);
      
      // Retorna 200 para não causar erro no sendBeacon, mas loga o problema
      return res.json({ 
        success: false, 
        reason: 'firestore_update_failed',
        message: error.message 
      });
    }
  });

  // Endpoint para criar solicitação de saída da aula (contorna bug do Firebase SDK 12.4.0)
  expressApp.post("/api/leave-request", async (req, res) => {
    try {
      if (!enforceRateLimit(req, res, 20)) return;
      const actor = await authenticatedUser(req, res);
      if (!actor) return;
      const { 
        sessaoId,
        presencaId,
        alunoId,
        alunoNome,
        alunoMatricula,
        turmaId,
        turmaNome,
        materia,
        professorId,
        professorNome,
        motivoAluno
      } = req.body;

      if (!sessaoId || !presencaId || !alunoId || !professorId) {
        return res.status(400).json({ 
          success: false, 
          message: "Dados obrigatórios faltando" 
        });
      }

      if (actor.uid !== alunoId) return res.status(403).json({ success: false, message: "A solicitação deve pertencer ao usuário autenticado" });

      if (!firebaseAdmin) {
        return res.status(503).json({ 
          success: false, 
          message: "Firebase Admin SDK não está configurado" 
        });
      }

      const db = firebaseAdmin.firestore();
      
      // Criar a solicitação de saída
      const docRef = await db.collection('solicitacoesSaida').add({
        sessaoId,
        presencaId,
        alunoId,
        alunoNome: alunoNome || "",
        alunoMatricula: alunoMatricula || "",
        turmaId: turmaId || "",
        turmaNome: turmaNome || "",
        materia: materia || "",
        professorId,
        professorNome: professorNome || "",
        status: "pendente",
        motivoAluno: motivoAluno || "",
        dataSolicitacao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      });

      console.log(`✅ Solicitação de saída criada: ${docRef.id} por aluno ${alunoId}`);
      return res.json({ 
        success: true, 
        requestId: docRef.id 
      });

    } catch (error: any) {
      console.error("❌ Erro ao criar solicitação de saída:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Erro interno ao criar solicitação" 
      });
    }
  });

  // Revogação real de refresh tokens para encerramento remoto de sessões.
  expressApp.post("/api/v1/admin/users/:userId/revoke-sessions", asyncRoute(async (req, res) => {
    const actor = await authenticatedUser(req, res);
    if (!actor) return;
    if (!(await isAdministrativeUser(actor.uid))) return res.status(403).json({ success: false, message: "Permissão administrativa necessária" });
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const { userId } = req.params;
    await firebaseAdmin.auth().revokeRefreshTokens(userId);
    const revokedAt = new Date().toISOString();
    await firebaseAdmin.firestore().collection("usuarios").doc(userId).update({ sessoesRevogadasEm: revokedAt, sessaoPreservadaId: null });
    await firebaseAdmin.firestore().collection("schoolAuditLogs").add({ action: "sessions_revoke_server", recordId: userId, moduleId: "acessos", actorId: actor.uid, actorName: actor.email || actor.uid, actorRole: "administrador", occurredAt: revokedAt, before: null, after: { refreshTokensRevoked: true }, immutable: true });
    return res.json({ success: true, revokedAt });
  }));

  // Entrada de webhooks: guarda a operação em fila para processamento assíncrono.
  expressApp.post("/api/v1/webhooks/:provider", asyncRoute(async (req, res) => {
    if (!firebaseAdmin) return res.status(503).json({ success: false, message: "Firebase Admin SDK não configurado" });
    const configuredSecret = process.env.WEBHOOK_SECRET;
    const suppliedSecret = req.header("x-webhook-secret");
    if (!configuredSecret || !suppliedSecret || suppliedSecret !== configuredSecret) {
      return res.status(401).json({ success: false, message: "Assinatura de webhook inválida" });
    }
    const provider = String(req.params.provider || "unknown").replace(/[^a-z0-9_-]/gi, "").slice(0, 50);
    const job = await firebaseAdmin.firestore().collection("integrationQueue").add({ provider, direction: "inbound", event: req.header("x-webhook-event") || "received", payload: req.body, status: "queued", attempts: 0, createdAt: new Date().toISOString() });
    return res.status(202).json({ success: true, jobId: job.id, status: "queued" });
  }));

  expressApp.get("/api/v1/integrations/catalog", asyncRoute(async (req, res) => {
    const actor = await authenticatedUser(req, res);
    if (!actor) return;
    if (!(await hasServerPermission(actor.uid, "integracoes.manage"))) return res.status(403).json({ success: false, message: "Permissão de integrações necessária" });
    return res.json({ success: true, providers: integrationCatalog(), checkedAt: new Date().toISOString() });
  }));

  expressApp.post("/api/v1/integrations/dispatch", asyncRoute(async (req, res) => {
    if (!enforceRateLimit(req, res, 20)) return;
    const actor = await authenticatedUser(req, res);
    if (!actor) return;
    if (!(await hasServerPermission(actor.uid, "integracoes.manage"))) return res.status(403).json({ success: false, message: "Permissão de integrações necessária" });
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const provider = String(req.body?.provider || "") as IntegrationProvider;
    const operation = String(req.body?.operation || "").replace(/[^a-z0-9._-]/gi, "").slice(0, 80);
    const payload = req.body?.payload ?? {};
    const serialized = JSON.stringify(payload);
    if (!integrationProviders.includes(provider) || !operation || serialized.length > 250_000) return res.status(400).json({ success: false, message: "Provedor, operação ou carga inválidos" });
    const configuration = integrationConfiguration(provider);
    if (!configuration.configured) return res.status(422).json({ success: false, message: `Configure INTEGRATION_${integrationEnvPrefix(provider)}_ENDPOINT e TOKEN no servidor.` });
    const idempotencyKey = String(req.body?.idempotencyKey || `${provider}-${operation}-${randomUUID()}`).replace(/[^a-z0-9._-]/gi, "").slice(0, 160);
    const existing = await firebaseAdmin.firestore().collection("integrationQueue").where("idempotencyKey", "==", idempotencyKey).limit(1).get();
    if (!existing.empty) return res.json({ success: true, duplicate: true, jobId: existing.docs[0].id, status: existing.docs[0].data().status });
    const createdAt = new Date().toISOString();
    const job = await firebaseAdmin.firestore().collection("integrationQueue").add({ provider, direction: "outbound", operation, payload, idempotencyKey, status: "queued", attempts: 0, availableAt: createdAt, createdAt, createdBy: actor.uid });
    await firebaseAdmin.firestore().collection("schoolAuditLogs").add({ action: "integration_dispatch_queued", recordId: job.id, moduleId: "integracoes", actorId: actor.uid, actorName: actor.email || actor.uid, actorRole: "integration_manager", occurredAt: createdAt, before: null, after: { provider, operation, idempotencyKey }, immutable: true });
    return res.status(202).json({ success: true, jobId: job.id, status: "queued", idempotencyKey });
  }));

  expressApp.get("/api/v1/jobs/:jobId", asyncRoute(async (req, res) => {
    const actor = await authenticatedUser(req, res);
    if (!actor) return;
    if (!(await hasServerPermission(actor.uid, "integracoes.manage"))) return res.status(403).json({ success: false, message: "Permissão de integrações necessária" });
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const snapshot = await firebaseAdmin.firestore().collection("integrationQueue").doc(req.params.jobId).get();
    if (!snapshot.exists) return res.status(404).json({ success: false, message: "Operação não encontrada" });
    return res.json({ id: snapshot.id, ...snapshot.data() });
  }));

  expressApp.post("/api/v1/cron/process-integration-queue", asyncRoute(async (req, res) => {
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const secret = req.header("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return res.status(401).json({ success: false, message: "Credencial de agendamento inválida" });
    const queued = await firebaseAdmin.firestore().collection("integrationQueue").where("status", "==", "queued").limit(100).get();
    let processed = 0;
    for (const item of queued.docs) {
      const job = item.data();
      if (job.availableAt && new Date(String(job.availableAt)).getTime() > Date.now()) continue;
      if (job.direction === "outbound") {
        const attempts = Number(job.attempts || 0) + 1;
        try {
          const result = await dispatchIntegration(job.provider as IntegrationProvider, String(job.operation || "dispatch"), job.payload, String(job.idempotencyKey || item.id));
          const eventRef = firebaseAdmin.firestore().collection("integrationEvents").doc();
          const batch = firebaseAdmin.firestore().batch();
          batch.set(eventRef, { jobId: item.id, provider: job.provider, direction: "outbound", operation: job.operation, idempotencyKey: job.idempotencyKey, result, receivedAt: new Date().toISOString(), payloadStored: false });
          batch.update(item.ref, { status: "completed", completedAt: result.completedAt, resultEventId: eventRef.id, attempts });
          await batch.commit();
        } catch (error: any) {
          const retry = attempts < 5;
          const delayMinutes = Math.min(60, 2 ** attempts);
          await item.ref.update({ status: retry ? "queued" : "failed", attempts, lastError: String(error.message || error).slice(0, 1_000), lastAttemptAt: new Date().toISOString(), availableAt: new Date(Date.now() + delayMinutes * 60_000).toISOString() });
        }
      } else {
        const batch = firebaseAdmin.firestore().batch();
        const eventRef = firebaseAdmin.firestore().collection("integrationEvents").doc();
        batch.set(eventRef, { jobId: item.id, ...job, receivedAt: new Date().toISOString(), payloadStored: true });
        batch.update(item.ref, { status: "completed", completedAt: new Date().toISOString(), resultEventId: eventRef.id, attempts: admin.firestore.FieldValue.increment(1) });
        await batch.commit();
      }
      processed += 1;
    }
    return res.json({ success: true, processed });
  }));

  expressApp.post("/api/v1/cron/process-reminders", asyncRoute(async (req, res) => {
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const secret = req.header("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return res.status(401).json({ success: false, message: "Credencial de agendamento inválida" });
    const now = Date.now();
    const horizon = now + 48 * 60 * 60 * 1000;
    const records = (await exportCollectionFully("schoolRecords")) as any[];
    const candidates = records.filter((record) => {
      if (record.deletedAt || /conclu|aprov|pago|cancel|encerr|fechad|arquivad/i.test(String(record.status || ""))) return false;
      const dueValue = record.customData?.prazo || record.customData?.prazoEntrega || record.customData?.vencimento || record.customData?.inicio || record.customData?.liberacao || record.customData?.validadeAcesso || record.customData?.dataReavaliacao;
      const due = new Date(String(dueValue || "")).getTime();
      const lastReminder = new Date(String(record.reminderSentAt || "")).getTime();
      return Number.isFinite(due) && due >= now && due <= horizon && (!Number.isFinite(lastReminder) || now - lastReminder >= 20 * 60 * 60 * 1000);
    }).slice(0, 200);
    let notifications = 0;
    for (const record of candidates) {
      const users = Array.from(new Set((record.audienceUserIds || []).filter(Boolean))) as string[];
      for (const userId of users) {
        const title = `Prazo próximo · ${record.title || "Atividade escolar"}`;
        const message = `O prazo de ${record.code || record.workflow || "um registro"} termina nas próximas 48 horas.`;
        await firebaseAdmin.firestore().collection("schoolNotifications").add({
          userId, createdBy: "system-cron", title,
          message,
          moduleId: record.moduleId, recordId: record.id, read: false, createdAt: new Date().toISOString(), type: "deadline_reminder",
        });
        notifications += 1;
        const profileSnapshot = await firebaseAdmin.firestore().collection("usuarios").doc(userId).get();
        const profile = profileSnapshot.data() || {};
        const preferences = profile.preferenciasNotificacao && typeof profile.preferenciasNotificacao === "object" ? profile.preferenciasNotificacao : {};
        const availableAt = notificationAvailableAt(preferences);
        const targets: Array<{ provider: IntegrationProvider; enabled: boolean; destination: string }> = [
          { provider: "email", enabled: preferences.email === true, destination: String(profile.email || "") },
          { provider: "whatsapp", enabled: preferences.whatsapp === true, destination: String(profile.telefone || "") },
          { provider: "push", enabled: preferences.push === true, destination: String(profile.pushToken || profile.notificationToken || userId) },
        ];
        for (const target of targets) {
          if (!target.enabled || !target.destination || !integrationConfiguration(target.provider).configured) continue;
          const idempotencyKey = `reminder-${record.id}-${userId}-${target.provider}-${new Date().toISOString().slice(0, 10)}`;
          await firebaseAdmin.firestore().collection("integrationQueue").add({ provider: target.provider, direction: "outbound", operation: "deadline_reminder", payload: { destination: target.destination, userId, title, message, moduleId: record.moduleId, recordId: record.id }, idempotencyKey, status: "queued", attempts: 0, availableAt, createdAt: new Date().toISOString(), createdBy: "system-cron" });
        }
      }
      await firebaseAdmin.firestore().collection("schoolRecords").doc(record.id).update({ reminderSentAt: new Date().toISOString() });
    }
    return res.json({ success: true, records: candidates.length, notifications });
  }));

  expressApp.post("/api/v1/cron/daily-backup", asyncRoute(async (req, res) => {
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const secret = req.header("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return res.status(401).json({ success: false, message: "Credencial de agendamento inválida" });
    const collectionNames = [
      "usuarios", "solicitacoes", "reprovacoes", "publicRegistrationLocks", "guardianLinks", "loginHistory", "system", "systemMaintenance",
      "turmas", "materiasCustomizadas", "disponibilidadeProfessores", "eventosCalendario", "gradesHorarias", "historicoGrades", "configuracaoHorarios", "bimestresConfig",
      "tarefas", "entregas", "avaliacoes", "avaliacaoQuestoes", "avaliacaoTemplates", "avaliacaoEntregas", "avaliacaoAutorizacoesAtraso",
      "notasBimestre", "solicitacoesEdicaoNota", "boletins", "boletimConfigs", "boletimDocumentos",
      "frequencia", "frequencias", "registroPresencas", "chamadasDiarias", "registrosPresencaChamada", "resumosPresencaDia", "presencasAulas",
      "aulasAgendadas", "sessoesAulaAoVivo", "presencasAulaAoVivo", "solicitacoesSaida",
      "financialInvoices", "financialSettings", "scholarships", "disciplinaryActions", "disciplinaryRequests",
      "announcements", "notificacoesHorarios", "chatConversations", "chatMessages", "chatPenalties", "chatReports", "userBlocks",
      "schoolRecords", "schoolPrivateNotes", "schoolAuditLogs", "schoolNotifications", "schoolDocumentValidations", "schoolFiles",
      "integrationQueue", "integrationEvents", "securityAlerts",
    ];
    const exportedAt = new Date().toISOString();
    const collections: Record<string, unknown[]> = {};
    for (const name of collectionNames) {
      collections[name] = await exportCollectionFully(name);
    }
    const fileChunks = await exportSchoolFileChunks();
    const raw = Buffer.from(JSON.stringify({ format: "vestibulando-firestore-backup", version: 2, exportedAt, collections, fileChunks }));
    const compressed = await gzipAsync(raw);
    const integrityHash = createHash("sha256").update(compressed).digest("hex");
    const backupRef = firebaseAdmin.firestore().collection("schoolBackups").doc();
    await backupRef.set({ type: "daily", repository: "firestore-chunks", exportedAt, integrityHash, compressedBytes: compressed.length, fileChunkCount: fileChunks.length, status: "writing", collections: Object.fromEntries(Object.entries(collections).map(([name, rows]) => [name, rows.length])) });
    const chunkCount = await writeBackupChunks(backupRef, compressed);
    await backupRef.update({ status: "completed", chunkCount, completedAt: new Date().toISOString() });
    const supersededBackupsRemoved = await pruneSupersededBackups(backupRef.id);
    await backupRef.update({ supersededBackupsRemoved });
    return res.json({ success: true, backupId: backupRef.id, repository: "firestore-chunks", integrityHash, compressedBytes: compressed.length, fileChunkCount: fileChunks.length, chunkCount, supersededBackupsRemoved });
  }));

  expressApp.post("/api/v1/cron/verify-latest-backup", asyncRoute(async (req, res) => {
    if (!firebaseAdmin) return res.status(503).json({ success: false });
    const secret = req.header("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return res.status(401).json({ success: false, message: "Credencial de agendamento inválida" });
    const backups = await firebaseAdmin.firestore().collection("schoolBackups").orderBy("exportedAt", "desc").limit(10).get();
    const latest = backups.docs.find((entry) => entry.data().status === "completed");
    if (!latest) return res.status(404).json({ success: false, message: "Nenhum backup automático encontrado" });
    const backupData = latest.data();
    const compressed = await readBackupChunks(latest.ref, Number(backupData.chunkCount || 0));
    const hash = createHash("sha256").update(compressed).digest("hex");
    const expectedHash = String(backupData.integrityHash || "");
    const raw = await gunzipAsync(compressed);
    const payload = JSON.parse(raw.toString("utf8"));
    const fileChunks = Array.isArray(payload.fileChunks) ? payload.fileChunks : [];
    const filesValid = fileChunks.length === Number(backupData.fileChunkCount || 0);
    const valid = expectedHash === hash && payload.format === "vestibulando-firestore-backup" && payload.version === 2 && typeof payload.collections === "object" && filesValid;
    await firebaseAdmin.firestore().collection("schoolBackupTests").add({ backupId: latest.id, repository: "firestore-chunks", testedAt: new Date().toISOString(), expectedHash, integrityHash: hash, valid, filesValid, fileChunkCount: fileChunks.length, collectionCount: Object.keys(payload.collections || {}).length });
    return res.status(valid ? 200 : 422).json({ success: valid, backupId: latest.id, expectedHash, integrityHash: hash, filesValid, fileChunkCount: fileChunks.length, collectionCount: Object.keys(payload.collections || {}).length });
  }));

  expressApp.post("/api/v1/admin/security/remove-legacy-passwords", asyncRoute(async (req, res) => {
    const actor = await authenticatedUser(req, res);
    if (!actor || !firebaseAdmin) return;
    if (!(await isAdministrativeUser(actor.uid))) return res.status(403).json({ success: false, message: "Permissão administrativa necessária" });
    const users = await firebaseAdmin.firestore().collection("usuarios").limit(10_000).get();
    const affected = users.docs.filter((entry) => typeof entry.data().senhaAtual === "string" || entry.data().senhaAtual != null);
    if (req.body?.confirm !== "REMOVER_SENHAS_LEGADAS") return res.json({ success: true, dryRun: true, affected: affected.length });
    for (let offset = 0; offset < affected.length; offset += 400) {
      const batch = firebaseAdmin.firestore().batch();
      for (const entry of affected.slice(offset, offset + 400)) batch.update(entry.ref, { senhaAtual: admin.firestore.FieldValue.delete(), senhaLegadaRemovidaEm: new Date().toISOString() });
      await batch.commit();
    }
    await firebaseAdmin.firestore().collection("schoolAuditLogs").add({ action: "legacy_plaintext_password_cleanup", recordId: "usuarios", moduleId: "lgpd-seguranca", actorId: actor.uid, actorName: actor.email || actor.uid, actorRole: "administrador", occurredAt: new Date().toISOString(), before: { affected: affected.length }, after: { plaintextFieldsRemaining: 0 }, immutable: true });
    return res.json({ success: true, dryRun: false, affected: affected.length });
  }));

  const httpServer = createServer(expressApp);
  return httpServer;
}
