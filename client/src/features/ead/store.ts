import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EadAccessibilityPreferences, EadAuditLog, EadRole } from "./types";

export const eadNow = () => new Date().toISOString();

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutUndefined(item)) as T;
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    ) as T;
  }
  return value;
}

interface UseEadCollectionOptions<T> {
  constraints?: QueryConstraint[];
  enabled?: boolean;
  filter?: (record: T) => boolean;
  sort?: (a: T, b: T) => number;
}

export function useEadCollection<T extends { id: string }>(
  collectionName: string,
  options: UseEadCollectionOptions<T> = {},
) {
  const { constraints = [], enabled = true, filter, sort } = options;
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const constraintsKey = JSON.stringify(
    constraints.map((constraint) => {
      const internal = constraint as any;
      return {
        type: String(internal?._queryConstraintType ?? "constraint"),
        field: String(internal?._field?.canonicalString?.() ?? internal?._field ?? ""),
        operator: String(internal?._op ?? ""),
        value: internal?._value ?? "",
        limit: internal?._limit ?? "",
      };
    }),
  );

  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const reference = constraints.length
      ? query(collection(db, collectionName), ...constraints)
      : query(collection(db, collectionName));

    const unsubscribe = onSnapshot(
      reference,
      (snapshot) => {
        const next = snapshot.docs.map((snapshotDocument) => ({
          id: snapshotDocument.id,
          ...snapshotDocument.data(),
        })) as T[];
        setRecords(next);
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(`Erro ao carregar ${collectionName}:`, snapshotError);
        setError(snapshotError.message || "Não foi possível carregar os dados.");
        setLoading(false);
      },
    );

    return unsubscribe;
    // Query constraints are created by callers and represented by a stable descriptive key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, enabled, constraintsKey]);

  const data = useMemo(() => {
    let next = filter ? records.filter(filter) : records;
    if (sort) next = [...next].sort(sort);
    return next;
  }, [records, filter, sort]);

  return { data, loading, error };
}

interface AuditActor {
  uid: string;
  nome: string;
  tipo: EadRole;
}

async function writeAudit(
  actor: AuditActor | null | undefined,
  action: string,
  entity: string,
  entityId?: string,
  details?: string,
) {
  if (!actor?.uid) return;
  const payload: Omit<EadAuditLog, "id"> = {
    userId: actor.uid,
    userName: actor.nome || "Usuário",
    userRole: actor.tipo,
    action,
    entity,
    entityId,
    details,
    createdAt: eadNow(),
  };

  try {
    await addDoc(collection(db, "eadAuditLogs"), payload);
  } catch (auditError) {
    console.warn("Não foi possível registrar auditoria EAD:", auditError);
  }
}

export async function createEadRecord<T extends DocumentData>(
  collectionName: string,
  data: T,
  actor?: AuditActor | null,
  auditLabel?: string,
) {
  const timestamp = eadNow();
  const reference = await addDoc(collection(db, collectionName), {
    ...withoutUndefined(data),
    createdAt: data.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
  await writeAudit(actor, "criar", collectionName, reference.id, auditLabel);
  return reference.id;
}

export async function setEadRecord<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: T,
  actor?: AuditActor | null,
  auditLabel?: string,
) {
  await setDoc(
    doc(db, collectionName, id),
    {
      ...withoutUndefined(data),
      updatedAt: eadNow(),
    },
    { merge: true },
  );
  await writeAudit(actor, "salvar", collectionName, id, auditLabel);
  return id;
}

export async function updateEadRecord<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: T,
  actor?: AuditActor | null,
  auditLabel?: string,
) {
  await updateDoc(doc(db, collectionName, id), {
    ...withoutUndefined(data),
    updatedAt: eadNow(),
  });
  await writeAudit(actor, "atualizar", collectionName, id, auditLabel);
}

export async function deleteEadRecord(
  collectionName: string,
  id: string,
  actor?: AuditActor | null,
  auditLabel?: string,
) {
  await deleteDoc(doc(db, collectionName, id));
  await writeAudit(actor, "excluir", collectionName, id, auditLabel);
}

const DEFAULT_ACCESSIBILITY: EadAccessibilityPreferences = {
  fontScale: 1,
  highContrast: false,
  reducedMotion: false,
  lowData: false,
  captions: true,
};

export function useEadAccessibility() {
  const [preferences, setPreferencesState] = useState<EadAccessibilityPreferences>(() => {
    try {
      const saved = localStorage.getItem("vestibulando-ead-accessibility");
      return saved ? { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(saved) } : DEFAULT_ACCESSIBILITY;
    } catch {
      return DEFAULT_ACCESSIBILITY;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ead-font-scale", String(preferences.fontScale));
    root.classList.toggle("ead-high-contrast", preferences.highContrast);
    root.classList.toggle("ead-reduced-motion", preferences.reducedMotion);
    root.classList.toggle("ead-low-data", preferences.lowData);
    localStorage.setItem("vestibulando-ead-accessibility", JSON.stringify(preferences));
  }, [preferences]);

  const setPreferences = (next: Partial<EadAccessibilityPreferences>) => {
    setPreferencesState((current) => ({ ...current, ...next }));
  };

  const resetPreferences = () => setPreferencesState(DEFAULT_ACCESSIBILITY);

  return { preferences, setPreferences, resetPreferences };
}

export async function imageFileToDataUrl(file: File, maxDimension = 1400, quality = 0.76) {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
  if (file.size > 12 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 12 MB.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      element.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length > 850_000) {
      return canvas.toDataURL("image/jpeg", 0.55);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function cacheLessonForOffline(lessonId: string, urls: string[]) {
  if (!("caches" in window)) throw new Error("Este navegador não oferece cache para uso posterior.");
  const validUrls = urls.filter(Boolean);
  if (!validUrls.length) throw new Error("Esta aula ainda não possui um material compatível para salvar.");
  const cache = await caches.open("vestibulando-ead-lessons-v1");
  const results = await Promise.allSettled(
    validUrls.map(async (url) => {
      const request = new Request(url, { mode: "cors" });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Falha ao salvar ${url}`);
      await cache.put(request, response.clone());
    }),
  );
  const successful = results.filter((result) => result.status === "fulfilled").length;
  if (!successful) {
    throw new Error("O servidor deste material não permite salvamento. Você ainda pode marcá-lo para ver depois.");
  }
  return successful;
}
