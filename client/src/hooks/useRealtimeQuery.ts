import { useEffect, useMemo, useRef } from "react";
import { useQuery, QueryKey } from "@tanstack/react-query";
import { 
  collection, 
  query, 
  onSnapshot, 
  QueryConstraint,
  DocumentData,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";

interface RealtimeQueryOptions<T> {
  collectionName: string;
  queryKey: QueryKey;
  constraints?: QueryConstraint[];
  transform?: (data: DocumentData[]) => T[];
  enabled?: boolean;
}

/**
 * Hook para queries em tempo real do Firestore com integração ao TanStack Query.
 * 
 * IMPORTANTE: Para garantir que os listeners sejam recriados quando as constraints mudarem,
 * você DEVE incluir todos os parâmetros dinâmicos das constraints no queryKey.
 * 
 * @example
 * // ✅ CORRETO - userData?.turma está tanto no queryKey quanto nas constraints
 * useRealtimeQuery({
 *   collectionName: "tarefas",
 *   queryKey: ["/api/tarefas", userData?.turma],
 *   constraints: userData?.turma ? [where("turma", "==", userData.turma)] : [],
 * });
 * 
 * // ❌ INCORRETO - userData?.turma não está no queryKey
 * useRealtimeQuery({
 *   collectionName: "tarefas",
 *   queryKey: ["/api/tarefas"],
 *   constraints: userData?.turma ? [where("turma", "==", userData.turma)] : [],
 * });
 * 
 * @param options - Opções da query em tempo real
 * @returns Resultado da query do TanStack Query com sincronização em tempo real
 */
export function useRealtimeQuery<T = any>({
  collectionName,
  queryKey,
  constraints = [],
  transform,
  enabled = true,
}: RealtimeQueryOptions<T>) {
  const subscriptionKey = useMemo(() => {
    return JSON.stringify(queryKey);
  }, [JSON.stringify(queryKey)]);
  
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      return transformRef.current ? transformRef.current(docs) : docs as T[];
    },
    enabled,
  });

  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  useEffect(() => {
    if (!enabled) return;

    const q = query(collection(db, collectionName), ...constraintsRef.current);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        const data = transformRef.current ? transformRef.current(docs) : docs as T[];
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error(`Erro no listener em tempo real para ${collectionName}:`, error);
      }
    );

    return () => unsubscribe();
  }, [collectionName, enabled, subscriptionKey]);

  return queryResult;
}
