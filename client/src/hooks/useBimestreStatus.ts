import { useMemo } from "react";
import { where } from "firebase/firestore";
import { useRealtimeQuery } from "./useRealtimeQuery";
import type { BimestreConfig } from "@shared/schema";
import { parseISO, isBefore, isAfter, isWithinInterval } from "date-fns";

export type BimestreStatus = "aguardando" | "em_andamento" | "fechado" | "inativo" | "nao_configurado";

export interface BimestreInfo {
  numero: number;
  status: BimestreStatus;
  isEditable: boolean;
  config: BimestreConfig | null;
  statusLabel: string;
}

export interface CurrentBimestreResult {
  currentBimestre: BimestreInfo | null;
  bimestresInfo: BimestreInfo[];
  isLoading: boolean;
  getBimestreStatus: (numero: number) => BimestreInfo;
  canEditBimestre: (numero: number, userType?: string) => boolean;
  canEmitBoletim: (numero: number, userType?: string) => boolean;
}

export function useBimestreStatus(ano: string): CurrentBimestreResult {
  const { data: bimestresConfigs, isLoading } = useRealtimeQuery<BimestreConfig>({
    collectionName: "bimestresConfig",
    queryKey: ["/api/bimestres-config", ano],
    constraints: [where("ano", "==", ano)],
    transform: (docs) => docs as BimestreConfig[],
    enabled: !!ano,
  });

  const bimestresInfo = useMemo((): BimestreInfo[] => {
    const now = new Date();
    
    return [1, 2, 3, 4].map((numero) => {
      const config = bimestresConfigs?.find(b => b.numero === numero) || null;
      
      if (!config) {
        return {
          numero,
          status: "nao_configurado" as BimestreStatus,
          isEditable: false,
          config: null,
          statusLabel: "Não configurado",
        };
      }

      if (!config.ativo) {
        return {
          numero,
          status: "inativo" as BimestreStatus,
          isEditable: false,
          config,
          statusLabel: "Inativo",
        };
      }

      const dataInicio = parseISO(config.dataInicio);
      const dataFim = parseISO(config.dataFim);
      const prazoNotas = parseISO(config.prazoLancamentoNotas);

      if (isBefore(now, dataInicio)) {
        return {
          numero,
          status: "aguardando" as BimestreStatus,
          isEditable: false,
          config,
          statusLabel: "Aguardando",
        };
      }

      if (isAfter(now, prazoNotas)) {
        return {
          numero,
          status: "fechado" as BimestreStatus,
          isEditable: false,
          config,
          statusLabel: "Encerrado",
        };
      }

      return {
        numero,
        status: "em_andamento" as BimestreStatus,
        isEditable: true,
        config,
        statusLabel: "Em andamento",
      };
    });
  }, [bimestresConfigs]);

  const currentBimestre = useMemo((): BimestreInfo | null => {
    const emAndamento = bimestresInfo.find(b => b.status === "em_andamento");
    if (emAndamento) return emAndamento;
    
    const now = new Date();
    for (const bimestre of bimestresInfo) {
      if (bimestre.config) {
        const dataInicio = parseISO(bimestre.config.dataInicio);
        const dataFim = parseISO(bimestre.config.dataFim);
        
        if (isWithinInterval(now, { start: dataInicio, end: dataFim })) {
          return bimestre;
        }
      }
    }
    
    return null;
  }, [bimestresInfo]);

  const getBimestreStatus = (numero: number): BimestreInfo => {
    return bimestresInfo.find(b => b.numero === numero) || {
      numero,
      status: "nao_configurado" as BimestreStatus,
      isEditable: false,
      config: null,
      statusLabel: "Não configurado",
    };
  };

  const canEditBimestre = (numero: number, userType?: string): boolean => {
    const bimestre = getBimestreStatus(numero);
    
    if (userType === "diretor") {
      return bimestre.status === "em_andamento";
    }
    
    return bimestre.isEditable && bimestre.status === "em_andamento";
  };

  const canEmitBoletim = (numero: number, userType?: string): boolean => {
    const bimestre = getBimestreStatus(numero);
    
    if (userType === "diretor") {
      return bimestre.status === "em_andamento";
    }
    
    return bimestre.isEditable && bimestre.status === "em_andamento";
  };

  return {
    currentBimestre,
    bimestresInfo,
    isLoading,
    getBimestreStatus,
    canEditBimestre,
    canEmitBoletim,
  };
}
