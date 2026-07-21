import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const FIRESTORE_FILE_MAX_BYTES = 8 * 1024 * 1024;
const RAW_CHUNK_BYTES = 400 * 1024;
const CHUNKS_PER_BATCH = 8;

export interface FirestoreFileAccess {
  ownerId: string;
  ownerRole?: string;
  audienceUserIds?: string[];
  audienceRoles?: string[];
  studentIds?: string[];
  classIds?: string[];
  purpose?: string;
  sensitive?: boolean;
}

export interface FirestoreFileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  chunkCount: number;
  sha256: string;
  status: "uploading" | "ready" | "failed";
  ownerId: string;
  ownerRole: string;
  audienceUserIds: string[];
  audienceRoles: string[];
  studentIds: string[];
  classIds: string[];
  purpose: string;
  sensitive: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface StoredFirestoreFile {
  id: string;
  url: string;
  reference: string;
  metadata: FirestoreFileMetadata;
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 32_768)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function firestoreFileId(reference: string): string | null {
  const value = String(reference || "").trim();
  const direct = value.match(/^firestore-file:([A-Za-z0-9_-]+)$/);
  if (direct) return direct[1];
  const path = value.match(/\/arquivo\/([A-Za-z0-9_-]+)/);
  return path?.[1] || null;
}

export function firestoreFileUrl(fileId: string): string {
  return `/arquivo/${fileId}`;
}

export async function storeFileInFirestore(file: File, access: FirestoreFileAccess): Promise<StoredFirestoreFile> {
  if (!access.ownerId) throw new Error("Não foi possível identificar o responsável pelo arquivo.");
  if (!file.size) throw new Error("O arquivo está vazio.");
  if (file.size > FIRESTORE_FILE_MAX_BYTES) throw new Error("No modo gratuito, cada arquivo pode ter no máximo 8 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const createdAt = new Date().toISOString();
  const fileRef = doc(collection(db, "schoolFiles"));
  const chunkCount = Math.ceil(bytes.length / RAW_CHUNK_BYTES);
  const metadata: FirestoreFileMetadata = {
    id: fileRef.id,
    name: file.name.replace(/[\u0000-\u001f]/g, "").slice(0, 180) || "arquivo",
    type: file.type || "application/octet-stream",
    size: file.size,
    chunkCount,
    sha256: await sha256(bytes),
    status: "uploading",
    ownerId: access.ownerId,
    ownerRole: String(access.ownerRole || "usuario"),
    audienceUserIds: unique([access.ownerId, ...(access.audienceUserIds || [])]),
    audienceRoles: unique(access.audienceRoles || []),
    studentIds: unique(access.studentIds || []),
    classIds: unique(access.classIds || []),
    purpose: String(access.purpose || "anexo").slice(0, 80),
    sensitive: access.sensitive === true,
    createdAt,
  };

  await setDoc(fileRef, { ...metadata, encoding: "base64-chunks-v1", repository: "firestore-free-tier" });
  try {
    for (let groupStart = 0; groupStart < chunkCount; groupStart += CHUNKS_PER_BATCH) {
      const batch = writeBatch(db);
      const groupEnd = Math.min(chunkCount, groupStart + CHUNKS_PER_BATCH);
      for (let index = groupStart; index < groupEnd; index += 1) {
        const start = index * RAW_CHUNK_BYTES;
        const chunk = bytes.subarray(start, Math.min(bytes.length, start + RAW_CHUNK_BYTES));
        batch.set(doc(collection(fileRef, "chunks"), String(index).padStart(5, "0")), {
          fileId: fileRef.id,
          index,
          ownerId: access.ownerId,
          byteLength: chunk.byteLength,
          data: bytesToBase64(chunk),
        });
      }
      await batch.commit();
    }
    const completedAt = new Date().toISOString();
    await updateDoc(fileRef, { status: "ready", completedAt });
    metadata.status = "ready";
    metadata.completedAt = completedAt;
    return { id: fileRef.id, url: firestoreFileUrl(fileRef.id), reference: `firestore-file:${fileRef.id}`, metadata };
  } catch (error) {
    await updateDoc(fileRef, { status: "failed", failedAt: new Date().toISOString() }).catch(() => undefined);
    throw error;
  }
}

export async function readFileFromFirestore(fileIdOrReference: string): Promise<{ metadata: FirestoreFileMetadata; blob: Blob }> {
  const fileId = firestoreFileId(fileIdOrReference) || fileIdOrReference;
  if (!/^[A-Za-z0-9_-]+$/.test(fileId)) throw new Error("Referência de arquivo inválida.");
  const fileRef = doc(db, "schoolFiles", fileId);
  const snapshot = await getDoc(fileRef);
  if (!snapshot.exists()) throw new Error("Arquivo não encontrado ou removido.");
  const metadata = snapshot.data() as FirestoreFileMetadata;
  if (metadata.status !== "ready") throw new Error("O arquivo ainda não terminou de ser enviado.");
  const chunksSnapshot = await getDocs(query(collection(fileRef, "chunks"), orderBy("index", "asc")));
  if (chunksSnapshot.size !== metadata.chunkCount) throw new Error("O arquivo está incompleto.");
  const chunks = chunksSnapshot.docs.map((entry) => base64ToBytes(String(entry.data().data || "")));
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (total !== metadata.size) throw new Error("O tamanho do arquivo não confere.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  const digest = await sha256(bytes);
  if (metadata.sha256 && digest !== metadata.sha256) throw new Error("A integridade do arquivo não pôde ser confirmada.");
  return { metadata: { ...metadata, id: fileId }, blob: new Blob([bytes], { type: metadata.type || "application/octet-stream" }) };
}

export async function downloadFileFromFirestore(reference: string, fallbackName = "arquivo"): Promise<void> {
  const { metadata, blob } = await readFileFromFirestore(reference);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = metadata.name || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
