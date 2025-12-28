import { useMemo } from "react";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Calendar,
  TrendingUp,
  BarChart3,
  FileCheck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { RegistroPresencaChamada, ChamadaDiaria } from "@shared/schema";

export function AlunoPresencasTab() {
  const { userData } = useAuth() as { userData: any };

  const { data: registros, isLoading: loadingRegistros } = useRealtimeQuery<RegistroPresencaChamada>({
    collectionName: "registrosPresencaChamada",
    queryKey: ["registrosPresencaChamada", userData?.uid],
    constraints: userData?.uid ? [
      where("alunoId", "==", userData.uid),
    ] : [],
    enabled: !!userData?.uid,
  });

  const { data: presencasAoVivo } = useRealtimeQuery<any>({
    collectionName: "presencasAulaAoVivo",
    queryKey: ["presencasAulaAoVivo", userData?.uid],
    constraints: userData?.uid ? [
      where("alunoId", "==", userData.uid),
      where("presencaValidada", "==", true)
    ] : [],
    enabled: !!userData?.uid,
  });

  const { data: chamadas } = useRealtimeQuery<ChamadaDiaria>({
    collectionName: "chamadasDiarias",
    queryKey: ["chamadasDiarias", userData?.turma],
    constraints: userData?.turma ? [
      where("turmaId", "==", userData.turma),
    ] : [],
    enabled: !!userData?.turma,
  });

  const registrosOrdenados = useMemo(() => {
    if (!registros) return [];
    return [...registros].sort((a, b) => b.data.localeCompare(a.data));
  }, [registros]);

  const estatisticas = useMemo(() => {
    if (!registros || registros.length === 0) return {
      total: 0,
      presencas: 0,
      ausencias: 0,
      justificadas: 0,
      aguardando: 0,
      porcentagem: 0,
    };

    const presencas = (registros?.filter(r => r.status === "presente").length || 0) + (presencasAoVivo?.length || 0);
    const ausencias = registros?.filter(r => r.status === "ausente").length || 0;
    const justificadas = registros?.filter(r => r.status === "justificado").length || 0;
    const aguardando = registros?.filter(r => r.status === "aguardando").length || 0;
    const total = (registros?.length || 0) + (presencasAoVivo?.length || 0);
    const registrosFinalizados = presencas + ausencias + justificadas;
    const porcentagem = registrosFinalizados > 0 
      ? Math.round(((presencas + justificadas) / registrosFinalizados) * 100) 
      : 0;

    return { total: total || 0, presencas, ausencias, justificadas, aguardando, porcentagem };
  }, [registros, presencasAoVivo]);

  const registrosPorDia = useMemo(() => {
    if (!registros || !chamadas) return [];

    const diasMap = new Map<string, {
      data: string;
      registros: (RegistroPresencaChamada & { chamada?: ChamadaDiaria })[];
    }>();

    registros.forEach(registro => {
      const chamada = chamadas.find(c => c.id === registro.chamadaId);
      const dia = registro.data;
      
      if (!diasMap.has(dia)) {
        diasMap.set(dia, { data: dia, registros: [] });
      }
      diasMap.get(dia)!.registros.push({ ...registro, chamada });
    });

    return Array.from(diasMap.values())
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [registros, chamadas]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "presente":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Presente
          </Badge>
        );
      case "ausente":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Ausente
          </Badge>
        );
      case "justificado":
        return (
          <Badge variant="secondary">
            <FileCheck className="h-3 w-3 mr-1" />
            Justificado
          </Badge>
        );
      case "aguardando":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatarData = (dataStr: string) => {
    try {
      const [year, month, day] = dataStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  if (loadingRegistros) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Minhas Presenças
        </h3>
        <p className="text-sm text-muted-foreground">
          Acompanhe seu registro de presenças nas aulas
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Aulas</CardDescription>
            <CardTitle className="text-2xl">{estatisticas.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Presenças</CardDescription>
            <CardTitle className="text-2xl text-green-600">{estatisticas.presencas}</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Faltas</CardDescription>
            <CardTitle className="text-2xl text-red-600">{estatisticas.ausencias}</CardTitle>
          </CardHeader>
          <CardContent>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Frequência</CardDescription>
            <CardTitle className={cn(
              "text-2xl",
              estatisticas.porcentagem >= 75 ? "text-green-600" : 
              estatisticas.porcentagem >= 50 ? "text-yellow-600" : "text-red-600"
            )}>
              {estatisticas.porcentagem}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress 
              value={estatisticas.porcentagem} 
              className={cn(
                "h-2",
                estatisticas.porcentagem < 75 && "[&>div]:bg-destructive"
              )}
            />
          </CardContent>
        </Card>
      </div>

      {estatisticas.porcentagem < 75 && estatisticas.total > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Atenção: Frequência Baixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sua frequência está abaixo de 75%. Mantenha sua presença para evitar problemas acadêmicos.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico" className="gap-2">
            <Calendar className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="por-dia" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Por Dia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-4">
          {registrosOrdenados.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum registro de presença encontrado.</p>
                <p className="text-sm">Os registros aparecerão aqui quando você confirmar sua presença nas aulas.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Matéria</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosOrdenados.map((registro) => {
                      const chamada = chamadas?.find(c => c.id === registro.chamadaId);
                      return (
                        <TableRow key={registro.id} data-testid={`row-presenca-${registro.id}`}>
                          <TableCell className="font-medium">
                            {formatarData(registro.data)}
                          </TableCell>
                          <TableCell>
                            {registro.tipo === "aula_ao_vivo" ? "Ao Vivo" : (chamada?.horarioNome || "-")}
                            {chamada && (
                              <span className="text-xs text-muted-foreground block">
                                {chamada.horarioInicio} - {chamada.horarioFim}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {registro.materia || chamada?.materia || "-"}
                            {(registro.professorNome || chamada?.professorNome) && (
                              <span className="text-xs text-muted-foreground block">
                                Prof. {(registro.professorNome || chamada?.professorNome || "").split(" ")[0]}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(registro.status)}
                            {registro.tipo === "aula_ao_vivo" && (
                              <Badge variant="outline" className="ml-2 text-primary border-primary">
                                Aula ao Vivo
                              </Badge>
                            )}
                            {registro.ausenteAutomatico && (
                              <span className="text-xs text-destructive block mt-1">
                                Não confirmou a tempo
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="por-dia" className="mt-4">
          {registrosPorDia.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum registro de presença encontrado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {registrosPorDia.map((dia) => {
                const presencasDia = dia.registros.filter(r => r.status === "presente").length;
                const totalDia = dia.registros.length;
                const porcentagemDia = totalDia > 0 ? Math.round((presencasDia / totalDia) * 100) : 0;

                return (
                  <Card key={dia.data} data-testid={`card-dia-${dia.data}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">
                          {formatarData(dia.data)}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={porcentagemDia >= 80 ? "default" : porcentagemDia >= 50 ? "secondary" : "destructive"}>
                            {presencasDia}/{totalDia} presenças
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dia.registros
                          .sort((a, b) => (a.chamada?.horarioInicio || "").localeCompare(b.chamada?.horarioInicio || ""))
                          .map((registro) => (
                            <div 
                              key={registro.id} 
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-sm">
                                  <span className="font-medium">{registro.chamada?.horarioNome}</span>
                                  <span className="text-muted-foreground"> - {registro.chamada?.materia}</span>
                                </div>
                              </div>
                              {getStatusBadge(registro.status)}
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
