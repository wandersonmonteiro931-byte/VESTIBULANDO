import { useMemo } from "react";
import { where } from "firebase/firestore";
import { useRealtimeQuery } from "./useRealtimeQuery";
import type { BimestreConfig } from "@shared/schema";
import { parseISO, isBefore, isAfter } from "date-fns";

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
    
    const configsByNumero = new Map<number, BimestreConfig[]>();
    if (bimestresConfigs) {
      for (const config of bimestresConfigs) {
        const existing = configsByNumero.get(config.numero) || [];
        existing.push(config);
        configsByNumero.set(config.numero, existing);
      }
    }
    
    const getNaturalStatus = (numero: number): BimestreInfo => {
      const configs = configsByNumero.get(numero) || [];
      
      if (configs.length === 0) {
        return {
          numero,
          status: "nao_configurado" as BimestreStatus,
          isEditable: false,
          config: null,
          statusLabel: "Não configurado",
        };
      }
      
      if (configs.length > 1) {
        return {
          numero,
          status: "nao_configurado" as BimestreStatus,
          isEditable: false,
          config: null,
          statusLabel: "Configuração duplicada",
        };
      }
      
      const config = configs[0];
      
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
    };

    const naturalStatuses = [1, 2, 3, 4].map(getNaturalStatus);
    
    const emAndamentoList = naturalStatuses.filter(b => b.status === "em_andamento");
    const highestEmAndamento = emAndamentoList.length > 0 
      ? Math.max(...emAndamentoList.map(b => b.numero))
      : null;
    
    return naturalStatuses.map((bimestre) => {
      if (highestEmAndamento !== null && 
          bimestre.numero < highestEmAndamento && 
          (bimestre.status === "em_andamento" || 
           (bimestre.config?.ativo && !isBefore(now, parseISO(bimestre.config.dataInicio))))) {
        return {
          ...bimestre,
          status: "fechado" as BimestreStatus,
          isEditable: false,
          statusLabel: "Encerrado",
        };
      }
      return bimestre;
    });
  }, [bimestresConfigs]);

  const currentBimestre = useMemo((): BimestreInfo | null => {
    const emAndamento = bimestresInfo.find(b => b.status === "em_andamento");
    return emAndamento || null;
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
