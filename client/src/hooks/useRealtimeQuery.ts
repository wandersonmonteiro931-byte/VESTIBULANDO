import { useEffect } from "react";
import { useQuery, UseQueryOptions, QueryKey } from "@tanstack/react-query";
import { 
  collection, 
  query, 
  where, 
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

export function useRealtimeQuery<T = any>({
  collectionName,
  queryKey,
  constraints = [],
  transform,
  enabled = true,
}: RealtimeQueryOptions<T>) {
  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      return transform ? transform(docs) : docs as T[];
    },
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;

    const q = query(collection(db, collectionName), ...constraints);
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        const data = transform ? transform(docs) : docs as T[];
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error(`Erro no listener em tempo real para ${collectionName}:`, error);
      }
    );

    return () => unsubscribe();
  }, [collectionName, enabled, queryKey, transform]);

  return queryResult;
}
