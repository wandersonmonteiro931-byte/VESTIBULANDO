import { useState, useEffect, useRef } from "react";
import { getMultiFactorResolver, signInWithEmailAndPassword, TotpMultiFactorGenerator, type MultiFactorResolver } from "firebase/auth";
import { addDoc, collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Loader2, Copy, Check, Search, AlertCircle, Shield, Users, CheckCircle, XCircle, Clock, Calendar, FileText, AlertTriangle, Wrench, PowerOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBrasiliaDateTime, getNowBrasiliaISO, brasiliaToUTC } from "@/lib/brasiliaTime";
import { HORARIOS_DISPONIVEIS } from "@shared/schema";
import logoUrl from "@assets/Blue and White Online School Logo (1)_1761189954480.png";
import { PortalBrand } from "@/components/PortalBrand";
import { getSessionId } from "@/lib/sessionSecurity";

async function registerSuccessfulLogin(profile: any) {
  const current = auth.currentUser;
  if (!current) return;
  const timestamp = new Date().toISOString();
  try {
    const token = await current.getIdToken();
    const response = await fetch("/api/v1/session/login", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ device: navigator.platform || "web", sessionId: getSessionId() }) });
    if (!response.ok) throw new Error("API de sessão indisponível");
  } catch {
    // Em hospedagem somente estática, preserva o histórico sem IP; a API de
    // servidor complementa IP e dispositivo quando estiver publicada.
    await addDoc(collection(db, "loginHistory"), {
      userId: current.uid,
      userNome: profile?.nome || current.displayName || current.email || current.uid,
      userTipo: profile?.tipo || "funcionario",
      action: "login",
      timestamp,
      ipAddress: "indisponível no cliente",
      userAgent: navigator.userAgent.slice(0, 500),
      device: navigator.platform || "web",
      sessionId: getSessionId(),
    });
  }
}

// Função para formatar CPF
function formatarCPF(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '');
  const limitado = apenasNumeros.slice(0, 11);
  
  if (limitado.length <= 3) return limitado;
  if (limitado.length <= 6) return `${limitado.slice(0, 3)}.${limitado.slice(3)}`;
  if (limitado.length <= 9) return `${limitado.slice(0, 3)}.${limitado.slice(3, 6)}.${limitado.slice(6)}`;
  return `${limitado.slice(0, 3)}.${limitado.slice(3, 6)}.${limitado.slice(6, 9)}-${limitado.slice(9)}`;
}

// Função para validar CPF (algoritmo oficial)
function validarCPF(cpf: string): boolean {
  const apenasNumeros = cpf.replace(/\D/g, '');
  
  if (apenasNumeros.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (CPF inválido)
  if (/^(\d)\1{10}$/.test(apenasNumeros)) return false;
  
  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(apenasNumeros.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(apenasNumeros.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(apenasNumeros.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(apenasNumeros.charAt(10))) return false;
  
  return true;
}

// Função para formatar Telefone (WhatsApp)
function formatarTelefone(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '');
  
  if (apenasNumeros.length <= 2) return apenasNumeros;
  if (apenasNumeros.length <= 7) return `(${apenasNumeros.slice(0, 2)})${apenasNumeros.slice(2)}`;
  if (apenasNumeros.length <= 11) return `(${apenasNumeros.slice(0, 2)})${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
  return `(${apenasNumeros.slice(0, 2)})${apenasNumeros.slice(2, 7)}-${apenasNumeros.slice(7)}`;
}

// Função para formatar CEP
function formatarCEP(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '');
  const limitado = apenasNumeros.slice(0, 8);
  
  if (limitado.length <= 5) return limitado;
  return `${limitado.slice(0, 5)}-${limitado.slice(5)}`;
}

// Função para buscar CEP na API ViaCEP
async function buscarCEP(cep: string) {
  try {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return null;
    
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    
    if (data.erro) return null;
    
    return {
      rua: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || ''
    };
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    return null;
  }
}

export default function Login() {
  const { toast } = useToast();
  const { userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "forgotPassword" | "diretorLogin">("login");
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [requestCode, setRequestCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionComment, setRejectionComment] = useState("");
  const [userToReject, setUserToReject] = useState<any>(null);
  const [editingSolicitacaoId, setEditingSolicitacaoId] = useState<string | null>(null);
  const [correctionToken, setCorrectionToken] = useState<string | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusMatricula, setStatusMatricula] = useState("");
  const [statusChecking, setStatusChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState<string>("");
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<any[]>([]);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationData, setConfirmationData] = useState({ cpf: "", dataNascimento: "" });
  const [pendingSolicitacao, setPendingSolicitacao] = useState<any>(null);
  const [confirmationError, setConfirmationError] = useState("");
  
  const [formData, setFormData] = useState({
    loginId: "", // CPF ou Matrícula
    password: "",
    nome: "",
    turma: "",
    dataNascimento: "",
    cpf: "",
    sexo: "",
    escolaridade: "",
    telefone: "",
    cep: "",
    rua: "",
    bairro: "",
    cidade: "",
    estado: "",
    email: "",
  });
  
  // Estados para recuperação de senha
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [forgotPasswordData, setForgotPasswordData] = useState({
    cpf: "",
    nomeCompleto: "",
    dataNascimento: "",
    email: "",
  });
  
  const [disponibilidade, setDisponibilidade] = useState<string[]>([]);
  const [horarioEspecialObservacao, setHorarioEspecialObservacao] = useState("");
  const [cpfValido, setCpfValido] = useState<boolean | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPublic, setPhotoPublic] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  
  // Estados para suspensão disciplinar
  const [showSuspensionOverlay, setShowSuspensionOverlay] = useState(false);
  const [suspensionData, setSuspensionData] = useState<any>(null);
  const [suspensionTimeRemaining, setSuspensionTimeRemaining] = useState<string>("");
  
  // Estados para manutenção do sistema
  const [showMaintenanceOverlay, setShowMaintenanceOverlay] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState<any>(null);
  
  // Estados para conta bloqueada
  const [showBlockedOverlay, setShowBlockedOverlay] = useState(false);
  
  // Estados para conta desativada
  const [showDeactivatedOverlay, setShowDeactivatedOverlay] = useState(false);
  
  // Estados para troca de senha obrigatória no primeiro acesso
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const redirectingAfterLoginRef = useRef(false);

  // Validar CPF em tempo real quando usuário digitar 11 números
  useEffect(() => {
    if (mode === "register" && formData.cpf) {
      const apenasNumeros = formData.cpf.replace(/\D/g, '');
      if (apenasNumeros.length === 11) {
        const valido = validarCPF(formData.cpf);
        setCpfValido(valido);
      } else {
        setCpfValido(null);
      }
    }
  }, [formData.cpf, mode]);

  useEffect(() => {
    if (!userData) {
      redirectingAfterLoginRef.current = false;
      return;
    }

    if (
      showCodeDialog ||
      showSuspensionOverlay ||
      showMaintenanceOverlay ||
      showBlockedOverlay ||
      showDeactivatedOverlay ||
      showPasswordChangeDialog
    ) {
      return;
    }

    // Verificar se é primeiro acesso de qualquer perfil operacional.
    if (
      (userData.tipo === "aluno" || userData.tipo === "professor" || userData.tipo === "responsavel" || userData.tipo === "funcionario") &&
      userData.primeiroAcesso !== false
    ) {
      setShowPasswordChangeDialog(true);
      return;
    }

    const targetPath =
      userData.tipo === "aluno"
        ? "/aluno"
        : userData.tipo === "professor"
          ? "/professor"
          : userData.tipo === "diretor"
            ? "/diretor"
            : userData.tipo === "responsavel" || userData.tipo === "funcionario"
              ? "/escola"
              : "/login";

    if (window.location.pathname === targetPath || redirectingAfterLoginRef.current) {
      return;
    }

    // Usa uma única navegação completa depois do login. Isso evita a disputa
    // entre efeitos do Login e das rotas protegidas que provocava React #185.
    redirectingAfterLoginRef.current = true;
    window.location.replace(targetPath);
  }, [
    userData?.uid,
    userData?.tipo,
    userData?.primeiroAcesso,
    showCodeDialog,
    showSuspensionOverlay,
    showMaintenanceOverlay,
    showBlockedOverlay,
    showDeactivatedOverlay,
    showPasswordChangeDialog,
  ]);

  // Carregar turmas disponíveis em tempo real, sem consultas repetitivas.
  useEffect(() => {
    if (mode !== "register") return;
    const unsubscribe = onSnapshot(collection(db, "turmas"), (turmasSnapshot) => {
      const turmasComStatus = turmasSnapshot.docs.map(doc => {
          const turmaData = doc.data() as any;
          const vagasTotais = turmaData.vagasTotais || 0;
          const vagasPreenchidas = turmaData.vagasPreenchidas || 0;
          const vagasRestantes = Math.max(0, vagasTotais - vagasPreenchidas);
          
          // Determinar status da turma
          let status = "aberta";
          let podeMatricular = true;
          
          // Verificar se a turma está ativa
          if (!turmaData.ativa) {
            status = "fechada";
            podeMatricular = false;
          } else {
            // Verificar vagas primeiro (tem prioridade)
            if (vagasRestantes === 0) {
              status = "esgotada";
              podeMatricular = false;
            } else if (vagasRestantes <= 5 && vagasRestantes > 0) {
              status = "vagas-esgotando";
            }
            
            // Verificar período de matrícula (só afeta se status ainda for "aberta")
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            if (turmaData.periodoMatriculaInicio && turmaData.periodoMatriculaFim) {
              const inicio = new Date(turmaData.periodoMatriculaInicio + 'T00:00:00');
              const fim = new Date(turmaData.periodoMatriculaFim + 'T23:59:59');
              
              if (hoje < inicio && status === "aberta") {
                status = "aguardando";
                podeMatricular = false;
              } else if (hoje > fim && status === "aberta") {
                status = "aberta-fora-periodo";
                podeMatricular = true;
              }
            }
          }
          
          return {
            id: doc.id,
            ...turmaData,
            alunosMatriculados: vagasPreenchidas,
            vagasRestantes,
            status,
            podeMatricular
          };
        });
      setTurmasDisponiveis(turmasComStatus.sort((a, b) => a.nome.localeCompare(b.nome)));
    }, (error) => console.error("Erro ao acompanhar turmas:", error));
    return unsubscribe;
  }, [mode]);

  // Buscar CEP quando usuário digitar
  useEffect(() => {
    const buscar = async () => {
      if (formData.cep.replace(/\D/g, '').length === 8) {
        setBuscandoCep(true);
        const resultado = await buscarCEP(formData.cep);
        if (resultado) {
          setFormData(prev => ({
            ...prev,
            rua: resultado.rua,
            bairro: resultado.bairro,
            cidade: resultado.cidade,
            estado: resultado.estado
          }));
        }
        setBuscandoCep(false);
      }
    };
    
    if (formData.cep && mode === "register") {
      buscar();
    }
  }, [formData.cep, mode]);

  // Atualizar contador de suspensão em tempo real
  useEffect(() => {
    if (!showSuspensionOverlay || !suspensionData) return;
    
    const updateCounter = () => {
      const now = new Date();
      const endDate = new Date(suspensionData.dataTerminoSuspensao);
      const diff = endDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setSuspensionTimeRemaining("Suspensão expirada");
        return;
      }
      
      // Mostrar tempo restante em horas totais para corresponder com "2 dias (48 horas)"
      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setSuspensionTimeRemaining(`${totalHours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
    };
    
    updateCounter();
    const intervalId = setInterval(updateCounter, 1000);
    
    return () => clearInterval(intervalId);
  }, [showSuspensionOverlay, suspensionData]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "register") {
        // Validações para registro
        if (!formData.nome || !formData.dataNascimento || !formData.cpf || !formData.sexo ||
            !formData.escolaridade || !formData.telefone || !formData.turma || 
            !formData.cep || !formData.rua || !formData.bairro || 
            !formData.cidade || !formData.estado || !formData.email || disponibilidade.length === 0) {
          toast({
            title: "Campos obrigatórios",
            description: "Por favor, preencha todos os campos obrigatórios, incluindo endereço completo",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // Validar se "Horário especial" foi marcado e se a observação foi preenchida
        if (disponibilidade.includes("Horário especial") && !horarioEspecialObservacao.trim()) {
          toast({
            title: "Observação obrigatória",
            description: "Por favor, descreva o horário especial selecionado",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // Validar CPF
        if (!validarCPF(formData.cpf)) {
          toast({
            title: "CPF inválido",
            description: "O CPF informado não é válido. Por favor, verifique e tente novamente.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        let matricula: string;

        try {
          const turmaSelecionada = turmasDisponiveis.find((turma) => turma.id === formData.turma);
          const application = {
            nome: formData.nome,
            email: formData.email,
            turma: turmaSelecionada?.nome || formData.turma,
            turmaId: formData.turma,
            dataNascimento: formData.dataNascimento,
            cpf: formData.cpf,
            sexo: formData.sexo,
            escolaridade: formData.escolaridade,
            telefone: formData.telefone,
            cep: formData.cep,
            rua: formData.rua,
            bairro: formData.bairro,
            cidade: formData.cidade,
            estado: formData.estado,
            disponibilidade,
            horarioEspecialObservacao: horarioEspecialObservacao || null,
            fotoBase64: photoBase64,
            fotoPublica: photoPublic,
          };
          const endpoint = editingSolicitacaoId
            ? `/api/v1/public/enrollment/correction/${encodeURIComponent(editingSolicitacaoId)}`
            : "/api/v1/public/enrollment/apply";
          if (editingSolicitacaoId && !correctionToken) throw new Error("Confirme novamente sua identidade antes de reenviar o cadastro.");
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ application, correctionToken }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.message || "Não foi possível salvar a solicitação.");
          matricula = result.matricula;
          setEditingSolicitacaoId(null);
          setCorrectionToken(null);
          setUserToReject(null);
        } catch (submissionError: any) {
          console.error("Erro ao salvar solicitação:", submissionError);
          toast({
            title: editingSolicitacaoId ? "Erro ao atualizar solicitação" : "Erro ao criar solicitação",
            description: submissionError.message || "Não foi possível enviar sua solicitação. Tente novamente.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        setRequestCode(matricula);
        setMode("login");
        setFormData({ 
          loginId: "",
          password: "", 
          nome: "", 
          turma: "",
          dataNascimento: "",
          cpf: "",
          sexo: "",
          escolaridade: "",
          telefone: "",
          cep: "",
          rua: "",
          bairro: "",
          cidade: "",
          estado: "",
          email: "",
        });
        setDisponibilidade([]);
        setPhotoFile(null);
        setPhotoBase64(null);
        setPhotoPublic(false);
        setCodeCopied(false);
        setLoading(false);
        
        setTimeout(() => {
          setShowCodeDialog(true);
        }, 100);
        
        return;
      } else if (mode === "diretorLogin") {
        // Login de diretor usando email e senha diretamente
        if (!formData.email || !formData.password) {
          toast({
            title: "Campos obrigatórios",
            description: "Por favor, informe email e senha",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        console.log("🔑 Tentando login de diretor com email:", formData.email);
        
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        console.log("✅ Autenticação bem-sucedida, UID:", userCredential.user.uid);
        
        const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));
        const currentUserData = userDoc.data();
        
        console.log("📄 Dados do usuário:", currentUserData);
        
        if (!currentUserData) {
          console.error("❌ Documento do usuário não encontrado no Firestore");
          toast({
            title: "Erro",
            description: "Dados do usuário não encontrados no banco de dados. Por favor, contate o administrador.",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (currentUserData.tipo !== "diretor") {
          console.warn("⚠️ Tipo de usuário incorreto:", currentUserData.tipo);
          toast({
            title: "Acesso negado",
            description: "Esta área é restrita à diretoria",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }

        await registerSuccessfulLogin(currentUserData);
        
        console.log("✅ Login de diretor bem-sucedido!");
        
        // DESATIVAR AUTOMATICAMENTE MANUTENÇÕES EXPIRADAS (somente diretores podem fazer isso)
        try {
          console.log("🔧 Verificando manutenções expiradas para desativar...");
          const { collection, getDocs, query, where, updateDoc, doc: firestoreDoc } = await import("firebase/firestore");
          
          const maintenanceQuery = query(
            collection(db, "systemMaintenance"),
            where("ativa", "==", true)
          );
          const maintenanceSnapshot = await getDocs(maintenanceQuery);
          
          for (const maintenanceDoc of maintenanceSnapshot.docs) {
            const maintenanceInfo = maintenanceDoc.data();
            
            if (maintenanceInfo.dataFim) {
              const nowBrasilia = new Date();
              const brasiliaFormatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              
              const parts = brasiliaFormatter.formatToParts(nowBrasilia);
              const brasiliaYear = parts.find(p => p.type === 'year')?.value;
              const brasiliaMonth = parts.find(p => p.type === 'month')?.value;
              const brasiliaDay = parts.find(p => p.type === 'day')?.value;
              const brasiliaHour = parts.find(p => p.type === 'hour')?.value;
              const brasiliaMinute = parts.find(p => p.type === 'minute')?.value;
              const brasiliaSecond = parts.find(p => p.type === 'second')?.value;
              
              const currentBrasiliaISO = brasiliaToUTC(
                `${brasiliaYear}-${brasiliaMonth}-${brasiliaDay}`,
                `${brasiliaHour}:${brasiliaMinute}:${brasiliaSecond}`
              );
              
              const currentTime = new Date(currentBrasiliaISO);
              const endTime = new Date(maintenanceInfo.dataFim);
              
              if (currentTime >= endTime) {
                console.log("✅ Desativando manutenção expirada:", maintenanceDoc.id);
                console.log("  - Finalizada por:", currentUserData.nome, "(UID:", userCredential.user.uid, ")");
                
                await updateDoc(firestoreDoc(db, "systemMaintenance", maintenanceDoc.id), {
                  ativa: false,
                  dataFinalizacao: getNowBrasiliaISO(),
                  finalizadoPor: userCredential.user.uid,
                  finalizadoPorNome: currentUserData.nome
                });
              }
            }
          }
        } catch (cleanupError) {
          console.error("Erro ao limpar manutenções expiradas:", cleanupError);
        }
        
        const refreshed = await refreshUserData();
        if (!refreshed) {
          throw new Error("Não foi possível carregar os dados da conta da diretoria.");
        }

        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo à Diretoria!",
        });

      } else {
        // Login usando CPF, matrícula ou e-mail institucional
        const rawLoginIdentifier = formData.loginId.trim().toLowerCase();
        const loginIdentifier = rawLoginIdentifier.replace(/\D/g, '');
        console.log("🔑 Tentando login com identificador:", loginIdentifier);
        
        // A resolução do identificador ocorre no backend com limitação de
        // tentativas. Nenhum cadastro completo é consultado publicamente.
        if (!rawLoginIdentifier.includes("@") && loginIdentifier.length !== 11 && loginIdentifier.length !== 4) {
          toast({
            title: "Credenciais inválidas",
            description: "Informe um e-mail, CPF (11 dígitos) ou matrícula (4 dígitos) válido",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const resolveResponse = await fetch("/api/v1/public/auth/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: rawLoginIdentifier }),
        });
        const resolved = await resolveResponse.json().catch(() => ({}));
        if (!resolveResponse.ok) throw new Error(resolved.message || "Não foi possível consultar a conta.");

        if (!resolved.found) {
          const application = resolved.application;
          if (application?.status === "reprovado") {
            setRejectionComment("A solicitação foi reprovada. Consulte a secretaria para receber os detalhes com segurança.");
            setShowRejectionDialog(true);
          } else if (application?.status === "standby") {
            toast({ title: "Em fila de espera", description: "Você está em fila de espera. Aguarde a avaliação da escola." });
          } else if (application?.status === "devolvido") {
            setStatusMatricula(application.matricula || loginIdentifier);
            setShowStatusDialog(true);
            toast({ title: "Cadastro devolvido", description: "Confirme CPF e data de nascimento em ‘Acompanhar solicitação’ para corrigir o cadastro." });
          } else if (application?.status === "pendente") {
            toast({ title: "Solicitação pendente", description: "Sua solicitação ainda está aguardando análise da escola." });
          } else {
            toast({ title: "Usuário não encontrado", description: "Não foi encontrado nenhum usuário com estas credenciais", variant: "destructive" });
          }
          setLoading(false);
          return;
        }

        const userData = resolved.user;
        const userEmail = userData?.email;
        if (!userData) {
          toast({
            title: "Usuário não encontrado",
            description: "Não foi encontrado nenhum usuário com estas credenciais",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        if (!userEmail) {
          toast({
            title: "Erro",
            description: "Email não encontrado para este usuário",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // VERIFICAR SE A CONTA ESTÁ BLOQUEADA (exceto para diretores)
        if (userData.tipo !== "diretor" && userData.bloqueado === true) {
          console.log("🚫 BLOQUEANDO LOGIN - Conta bloqueada");
          setShowBlockedOverlay(true);
          setLoading(false);
          return;
        }
        
        // VERIFICAR SE A CONTA ESTÁ DESATIVADA (exceto para diretores)
        if (userData.tipo !== "diretor" && userData.ativo === false) {
          // Verificar se é uma suspensão ativa
          if (userData.suspensaoAtiva === true && userData.suspensaoDataTermino) {
            const dataTermino = new Date(userData.suspensaoDataTermino);
            const agora = new Date();
            
            // Se a suspensão ainda está ativa, mostrar overlay de suspensão
            if (agora < dataTermino) {
              console.log("🚫 BLOQUEANDO LOGIN - Conta suspensa");
              setSuspensionData({
                alunoNome: userData.nome || "",
                comentario: userData.suspensaoMotivo,
                dataAplicacao: userData.suspensaoDataAplicacao,
                dataTerminoSuspensao: userData.suspensaoDataTermino,
                aplicadoPorNome: userData.suspensaoAplicadoPorNome || "Diretoria",
              });
              setShowSuspensionOverlay(true);
              setLoading(false);
              return;
            }
          }
          
          // Se não é suspensão ou a suspensão expirou, mostrar overlay de desativação
          console.log("🚫 BLOQUEANDO LOGIN - Conta desativada");
          setShowDeactivatedOverlay(true);
          setLoading(false);
          return;
        }
        
        // VERIFICAR MANUTENÇÃO DO SISTEMA ANTES DE AUTENTICAR (exceto para diretores)
        if (userData.tipo !== "diretor") {
          try {
            console.log("🔧 Verificando manutenção do sistema...");
            const { collection, getDocs, query, where } = await import("firebase/firestore");
            const maintenanceQuery = query(
              collection(db, "systemMaintenance"),
              where("ativa", "==", true)
            );
            const maintenanceSnapshot = await getDocs(maintenanceQuery);
            console.log("✅ Manutenções ativas encontradas:", maintenanceSnapshot.docs.length);
            
            if (!maintenanceSnapshot.empty) {
              const activeMaintenance = maintenanceSnapshot.docs[0].data();
              
              // VERIFICAR SE A MANUTENÇÃO JÁ EXPIROU (usando horário de Brasília)
              if (activeMaintenance.dataFim) {
                const nowBrasilia = new Date();
                const brasiliaFormatter = new Intl.DateTimeFormat('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                });
                
                const parts = brasiliaFormatter.formatToParts(nowBrasilia);
                const brasiliaYear = parts.find(p => p.type === 'year')?.value;
                const brasiliaMonth = parts.find(p => p.type === 'month')?.value;
                const brasiliaDay = parts.find(p => p.type === 'day')?.value;
                const brasiliaHour = parts.find(p => p.type === 'hour')?.value;
                const brasiliaMinute = parts.find(p => p.type === 'minute')?.value;
                const brasiliaSecond = parts.find(p => p.type === 'second')?.value;
                
                const currentBrasiliaISO = brasiliaToUTC(
                  `${brasiliaYear}-${brasiliaMonth}-${brasiliaDay}`,
                  `${brasiliaHour}:${brasiliaMinute}:${brasiliaSecond}`
                );
                
                const currentTime = new Date(currentBrasiliaISO);
                const endTime = new Date(activeMaintenance.dataFim);
                
                console.log("🕒 Verificando se manutenção expirou:");
                console.log("  - Hora atual (Brasília):", currentBrasiliaISO);
                console.log("  - Hora fim da manutenção:", activeMaintenance.dataFim);
                console.log("  - Expirou?", currentTime >= endTime);
                
                if (currentTime >= endTime) {
                  console.log("✅ Manutenção expirou - permitindo login");
                  // Manutenção expirou - NÃO bloquear o login
                  // A manutenção será desativada automaticamente quando um diretor fizer login
                } else {
                  // Manutenção ainda está ativa - BLOQUEAR LOGIN
                  console.log("🚫 BLOQUEANDO LOGIN - Sistema em manutenção");
                  console.log("📋 Dados da manutenção:", activeMaintenance);
                  
                  setMaintenanceData(activeMaintenance);
                  setShowMaintenanceOverlay(true);
                  setLoading(false);
                  
                  console.log("✅ Overlay de manutenção configurado - NÃO AUTENTICAR");
                  return;
                }
              } else {
                // Manutenção indeterminada - sempre bloquear
                console.log("🚫 BLOQUEANDO LOGIN - Manutenção indeterminada");
                console.log("📋 Dados da manutenção:", activeMaintenance);
                
                setMaintenanceData(activeMaintenance);
                setShowMaintenanceOverlay(true);
                setLoading(false);
                
                console.log("✅ Overlay de manutenção configurado - NÃO AUTENTICAR");
                return;
              }
            } else {
              console.log("✅ Nenhuma manutenção ativa");
            }
          } catch (maintenanceError: any) {
            console.error('❌ Erro ao verificar manutenção:', maintenanceError);
            if (maintenanceError?.code === 'permission-denied') {
              console.warn('⚠️ AVISO: Erro de permissão ao verificar manutenção');
            }
          }
        }
        
        // Autenticar no Firebase APENAS se não estiver suspenso, bloqueado ou em manutenção
        const userCredential = await signInWithEmailAndPassword(auth, userEmail, formData.password);
        
        // Verificar status da conta
        if (userData.status === "reprovado") {
          toast({
            title: "Acesso negado",
            description: "Sua conta foi reprovada pelo administrador.",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (userData.status === "pendente") {
          toast({
            title: "Conta pendente",
            description: "Sua conta ainda está aguardando aprovação.",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        await refreshUserData();
        await registerSuccessfulLogin(userData);
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta!",
        });
      }
    } catch (error: any) {
      console.error("❌ Erro durante login:", error);
      console.error("Código do erro:", error.code);
      console.error("Mensagem do erro:", error.message);
      
      if (error.code === "auth/multi-factor-auth-required") {
        const resolver = getMultiFactorResolver(auth, error);
        const totpHint = resolver.hints.find((hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (totpHint) {
          setMfaResolver(resolver);
          setMfaCode("");
          setMfaError("");
          setShowMfaDialog(true);
          setLoading(false);
          return;
        }
      }

      let message = "Ocorreu um erro. Tente novamente.";
      if (error.code === "auth/wrong-password") {
        message = "Senha incorreta";
      } else if (error.code === "auth/invalid-credential") {
        // Mensagem diferente dependendo do modo de login
        message = mode === "diretorLogin" 
          ? "Email ou senha incorretos. Verifique suas credenciais e tente novamente." 
          : "CPF/Matrícula ou senha incorretos";
      } else if (error.code === "auth/user-not-found") {
        message = mode === "diretorLogin"
          ? "Este email não está registrado no sistema. Por favor, contate o administrador."
          : "CPF/Matrícula não encontrado";
      } else if (error.code === "auth/invalid-email") {
        message = "Email inválido. Verifique o formato do email.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";
      } else if (error.code) {
        message = `Erro: ${error.code}`;
        console.error("Detalhes do erro:", error);
      } else {
        message = error.message || "Erro desconhecido";
      }
      
      toast({
        title: mode === "register" ? "Erro ao criar conta" : "Erro ao fazer login",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mfaResolver || !/^\d{6}$/.test(mfaCode)) {
      setMfaError("Informe o código de 6 dígitos do aplicativo autenticador.");
      return;
    }
    setMfaLoading(true);
    setMfaError("");
    try {
      const hint = mfaResolver.hints.find((entry) => entry.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!hint) throw new Error("Fator TOTP não encontrado para esta conta.");
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode);
      await mfaResolver.resolveSignIn(assertion);
      const profileSnapshot = auth.currentUser ? await getDoc(doc(db, "usuarios", auth.currentUser.uid)) : null;
      await registerSuccessfulLogin(profileSnapshot?.data());
      await refreshUserData();
      setShowMfaDialog(false);
      setMfaResolver(null);
      toast({ title: "Verificação concluída", description: "A autenticação em duas etapas foi confirmada." });
    } catch (error: any) {
      setMfaError(error.code === "auth/invalid-verification-code" || error.code === "auth/invalid-multi-factor-session" ? "Código inválido ou expirado. Gere um novo código no aplicativo." : error.message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (forgotPasswordStep === 1) {
      // Não revela se o CPF existe. A identidade é validada em conjunto com
      // nome, nascimento e e-mail no passo seguinte, no backend limitado.
      if (forgotPasswordData.cpf.replace(/\D/g, "").length !== 11) {
        toast({ title: "CPF inválido", description: "Informe os 11 dígitos do CPF.", variant: "destructive" });
        return;
      }
      setForgotPasswordStep(2);
    } else if (forgotPasswordStep === 2) {
      setLoading(true);
      try {
        const verificationResponse = await fetch("/api/v1/public/auth/verify-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: forgotPasswordData.cpf, name: forgotPasswordData.nomeCompleto, birthDate: forgotPasswordData.dataNascimento, email: forgotPasswordData.email }),
        });
        const verification = await verificationResponse.json().catch(() => ({}));
        if (!verificationResponse.ok || !verification.verified) throw new Error(verification.message || "Os dados informados não conferem.");
        const { sendPasswordResetEmail } = await import("firebase/auth");
        await sendPasswordResetEmail(auth, verification.email);
        
        toast({
          title: "Email enviado com sucesso!",
          description: "Foi enviado um link de recuperação de senha para o seu email. Verifique sua caixa de entrada e spam.",
        });
        
        // Resetar o formulário e voltar ao login
        setMode("login");
        setForgotPasswordStep(1);
        setForgotPasswordData({
          cpf: "",
          nomeCompleto: "",
          dataNascimento: "",
          email: "",
        });
      } catch (resetError: any) {
        console.error("Erro ao enviar email:", resetError);
        
        let errorMessage = resetError.message || "Não foi possível enviar o email de recuperação. Tente novamente mais tarde.";
        
        if (resetError.code === "auth/too-many-requests") {
          errorMessage = "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
        } else if (resetError.code === "auth/user-not-found") {
          errorMessage = "Usuário não encontrado no sistema de autenticação.";
        }
        
        toast({
          title: "Erro ao enviar email",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(requestCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({
        title: "Matrícula copiada!",
        description: "A matrícula foi copiada para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a matrícula.",
        variant: "destructive",
      });
    }
  };

  const handleVerificarStatus = async () => {
    if (!statusMatricula || statusMatricula.length !== 4) {
      setStatusError("Por favor, informe uma matrícula válida de 4 dígitos.");
      return;
    }

    setStatusChecking(true);
    setStatusResult(null);
    setStatusError("");

    try {
      const response = await fetch("/api/v1/public/enrollment/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollment: statusMatricula }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Não foi possível verificar o status.");
      if (!result.found) setStatusError("Não foi encontrada nenhuma solicitação com esta matrícula.");
      else setStatusResult(result.result);
    } catch (error: any) {
      console.error("Erro ao verificar status:", error);
      setStatusError(error.message || "Não foi possível verificar o status. Tente novamente.");
    } finally {
      setStatusChecking(false);
    }
  };

  const toggleDisponibilidade = (valor: string) => {
    setDisponibilidade(prev => 
      prev.includes(valor) 
        ? prev.filter(d => d !== valor)
        : [...prev, valor]
    );
  };

  const handleConfirmIdentity = async () => {
    if (!pendingSolicitacao) return;
    setStatusChecking(true);
    setConfirmationError("");
    try {
      const response = await fetch("/api/v1/public/enrollment/correction/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollment: pendingSolicitacao.matricula || statusMatricula, cpf: confirmationData.cpf, birthDate: confirmationData.dataNascimento }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "CPF ou data de nascimento não conferem com o cadastro.");
      const application = result.application || {};
      setEditingSolicitacaoId(result.id);
      setCorrectionToken(result.correctionToken);
    setFormData({
      loginId: "",
      password: "",
        nome: application.nome || "",
        turma: application.turmaId || "",
        dataNascimento: application.dataNascimento || "",
        cpf: application.cpf || "",
        sexo: application.sexo || "",
        escolaridade: application.escolaridade || "",
        telefone: application.telefone || "",
        cep: application.cep || "",
        rua: application.rua || "",
        bairro: application.bairro || "",
        cidade: application.cidade || "",
        estado: application.estado || "",
        email: application.email || "",
    });
      if (application.disponibilidade) {
        setDisponibilidade(application.disponibilidade);
    }
      setHorarioEspecialObservacao(application.horarioEspecialObservacao || "");
      if (application.fotoBase64) {
        setPhotoBase64(application.fotoBase64);
    }
      if (application.fotoPublica !== undefined) {
        setPhotoPublic(application.fotoPublica);
    }
      setShowConfirmationDialog(false);
      setShowStatusDialog(false);
      setConfirmationData({ cpf: "", dataNascimento: "" });
      setPendingSolicitacao(null);
      setMode("register");
      toast({ title: "Identidade confirmada", description: "Você pode editar seu cadastro e reenviar." });
    } catch (error: any) {
      setConfirmationError(error.message || "CPF ou data de nascimento não conferem com o cadastro.");
    } finally {
      setStatusChecking(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError("");
    
    // Validações
    if (!newPassword || !confirmNewPassword) {
      setPasswordChangeError("Por favor, preencha todos os campos.");
      return;
    }
    
    if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordChangeError("Use pelo menos 10 caracteres, com letra maiúscula, minúscula e número.");
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("As senhas não conferem. Por favor, digite novamente.");
      return;
    }
    
    setPasswordChangeLoading(true);
    
    try {
      // Atualizar senha no Firebase Auth
      const { updatePassword } = await import("firebase/auth");
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        
        // Atualizar no Firestore para marcar que não é mais primeiro acesso
        const { updateDoc, doc: firestoreDoc } = await import("firebase/firestore");
        await updateDoc(firestoreDoc(db, "usuarios", auth.currentUser.uid), {
          primeiroAcesso: false,
          forcarTrocaSenha: false,
          senhaAlteradaEm: new Date().toISOString(),
        });
        
        // Atualizar userData local
        await refreshUserData();
        
        toast({
          title: "Senha alterada com sucesso!",
          description: "Sua senha foi atualizada. Você será redirecionado para o sistema.",
        });
        
        // Limpar estados e fechar diálogo
        setNewPassword("");
        setConfirmNewPassword("");
        setPasswordChangeError("");
        setShowPasswordChangeDialog(false);
      } else {
        setPasswordChangeError("Usuário não autenticado. Por favor, faça login novamente.");
      }
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      
      let errorMessage = "Não foi possível alterar a senha. Tente novamente.";
      
      if (error.code === "auth/weak-password") {
        errorMessage = "Senha muito fraca. Use 10 caracteres ou mais, com maiúscula, minúscula e número.";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Por questões de segurança, você precisa fazer login novamente para alterar a senha.";
      }
      
      setPasswordChangeError(errorMessage);
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  return (
    <div className="login-modern min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="portal-login-topbar">
        <PortalBrand compactLabel="Acesso" />
      </div>
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <Card className="login-modern-card w-full max-w-2xl relative z-10">
        <CardHeader className="space-y-6 text-center pb-8">
          <div className="flex justify-center">
            <div className="login-brand-mark login-brand-mark-premium">
              <img src={logoUrl} alt="Vestibulando" className="login-brand-image" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="login-eyebrow">Plataforma educacional</div>
            <CardTitle className="login-title">Vestibulando</CardTitle>
            <CardDescription className="text-base login-subtitle">
              {mode === "register" ? "Formulário de Solicitação de Matrícula" : mode === "forgotPassword" ? "Recuperar Senha" : mode === "diretorLogin" ? "Login da Diretoria" : "Seja Bem-Vindo! Faça Login com sua Matrícula ou CPF"}
            </CardDescription>
            <div className="login-feature-grid">
              <div className="login-feature-chip"><CheckCircle className="h-4 w-4" /><span>Ambiente escolar</span></div>
              <div className="login-feature-chip"><Users className="h-4 w-4" /><span>Área do aluno e professor</span></div>
              <div className="login-feature-chip"><Shield className="h-4 w-4" /><span>Acesso protegido</span></div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {mode === "forgotPassword" ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {forgotPasswordStep === 1 && (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Digite seu CPF para iniciar o processo de recuperação de senha.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="forgot-cpf">CPF *</Label>
                    <Input
                      id="forgot-cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={forgotPasswordData.cpf}
                      onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, cpf: formatarCPF(e.target.value) })}
                      required
                      maxLength={14}
                      data-testid="input-forgot-cpf"
                    />
                  </div>
                </>
              )}
              
              {forgotPasswordStep === 2 && (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Para confirmar sua identidade, por favor preencha as informações abaixo exatamente como foram cadastradas.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="forgot-nome">Nome Completo (sem abreviações) *</Label>
                    <Input
                      id="forgot-nome"
                      type="text"
                      placeholder="Seu nome completo"
                      value={forgotPasswordData.nomeCompleto}
                      onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, nomeCompleto: e.target.value })}
                      required
                      data-testid="input-forgot-nome"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="forgot-nascimento">Data de Nascimento *</Label>
                    <Input
                      id="forgot-nascimento"
                      type="date"
                      value={forgotPasswordData.dataNascimento}
                      onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, dataNascimento: e.target.value })}
                      required
                      data-testid="input-forgot-nascimento"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email Cadastrado *</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotPasswordData.email}
                      onChange={(e) => setForgotPasswordData({ ...forgotPasswordData, email: e.target.value })}
                      required
                      data-testid="input-forgot-email"
                    />
                  </div>
                </>
              )}
              
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-forgot-submit">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {forgotPasswordStep === 1 ? "Continuar" : "Verificar Dados e Enviar Email"}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  className="login-text-link text-sm"
                  onClick={() => {
                    setMode("login");
                    setForgotPasswordStep(1);
                    setForgotPasswordData({
                      cpf: "",
                      nomeCompleto: "",
                      dataNascimento: "",
                      email: "",
                    });
                  }}
                  data-testid="button-back-to-login"
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === "register" && (
                <>
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-primary">Ambiente Seguro</p>
                      <p className="mt-1 text-muted-foreground">
                        Suas informações estão protegidas e serão utilizadas apenas para processos educacionais. Todos os dados são criptografados e mantidos em segurança.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome completo"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      data-testid="input-nome"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                      <Input
                        id="dataNascimento"
                        type="date"
                        value={formData.dataNascimento}
                        onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                        required
                        data-testid="input-data-nascimento"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <div className="relative">
                        <Input
                          id="cpf"
                          type="text"
                          placeholder="000.000.000-00"
                          value={formData.cpf}
                          onChange={(e) => setFormData({ ...formData, cpf: formatarCPF(e.target.value) })}
                          required
                          maxLength={14}
                          className={cpfValido === false ? "border-destructive" : cpfValido === true ? "border-green-500" : ""}
                          data-testid="input-cpf"
                        />
                        {cpfValido === true && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" data-testid="icon-cpf-valido" />
                        )}
                        {cpfValido === false && (
                          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-destructive" data-testid="icon-cpf-invalido" />
                        )}
                      </div>
                      {cpfValido === false && (
                        <p className="text-sm text-destructive">CPF inválido. Verifique os números digitados.</p>
                      )}
                      {cpfValido === true && (
                        <p className="text-sm text-green-600 dark:text-green-400">CPF válido ✓</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo *</Label>
                    <Select
                      value={formData.sexo}
                      onValueChange={(value) => setFormData({ ...formData, sexo: value })}
                      required
                    >
                      <SelectTrigger data-testid="select-sexo">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao-binario">Não binário</SelectItem>
                        <SelectItem value="prefiro-nao-informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="escolaridade">Escolaridade *</Label>
                      <Select
                        value={formData.escolaridade}
                        onValueChange={(value) => setFormData({ ...formData, escolaridade: value })}
                        required
                      >
                        <SelectTrigger data-testid="select-escolaridade">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem-estudo">Sem estudo - Analfabeto</SelectItem>
                          <SelectItem value="fundamental-cursando">Ensino Fundamental - Cursando</SelectItem>
                          <SelectItem value="fundamental-completo">Ensino Fundamental - Completo</SelectItem>
                          <SelectItem value="fundamental-incompleto">Ensino Fundamental - Incompleto</SelectItem>
                          <SelectItem value="medio-cursando">Ensino Médio - Cursando</SelectItem>
                          <SelectItem value="medio-completo">Ensino Médio - Completo</SelectItem>
                          <SelectItem value="medio-incompleto">Ensino Médio - Incompleto</SelectItem>
                          <SelectItem value="superior-cursando">Ensino Superior - Cursando</SelectItem>
                          <SelectItem value="superior-completo">Ensino Superior - Completo</SelectItem>
                          <SelectItem value="superior-incompleto">Ensino Superior - Incompleto</SelectItem>
                          <SelectItem value="pos-cursando">Pós-Graduação - Cursando</SelectItem>
                          <SelectItem value="pos-completo">Pós-Graduação - Completo</SelectItem>
                          <SelectItem value="pos-incompleto">Pós-Graduação - Incompleto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone (WhatsApp) *</Label>
                      <Input
                        id="telefone"
                        type="tel"
                        placeholder="(00)00000-0000"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: formatarTelefone(e.target.value) })}
                        required
                        data-testid="input-telefone"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      required
                      data-testid="input-email"
                    />
                    {emailFocused && (
                      <p className="text-xs text-muted-foreground">
                        O email não poderá ser alterado futuramente.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="turma">Turma *</Label>
                    <Select
                      value={formData.turma}
                      onValueChange={(value) => setFormData({ ...formData, turma: value })}
                      required
                    >
                      <SelectTrigger data-testid="select-turma">
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {turmasDisponiveis.length === 0 ? (
                          <SelectItem value="none" disabled>Nenhuma turma disponível</SelectItem>
                        ) : (
                          turmasDisponiveis.map((turma: any) => (
                            <SelectItem 
                              key={turma.id} 
                              value={turma.id}
                              disabled={!turma.podeMatricular}
                            >
                              <div className="flex items-center justify-between w-full gap-3">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{turma.nome}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {turma.alunosMatriculados}/{turma.vagasTotais || 0}
                                  </span>
                                  {turma.status === "aberta" && (
                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Aberta
                                    </Badge>
                                  )}
                                  {turma.status === "aberta-fora-periodo" && (
                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Aberta
                                    </Badge>
                                  )}
                                  {turma.status === "vagas-esgotando" && (
                                    <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-white gap-1">
                                      <Clock className="h-3 w-3" />
                                      Vagas esgotando
                                    </Badge>
                                  )}
                                  {turma.status === "esgotada" && (
                                    <Badge variant="destructive" className="gap-1">
                                      <XCircle className="h-3 w-3" />
                                      Vagas esgotadas
                                    </Badge>
                                  )}
                                  {turma.status === "aguardando" && (
                                    <Badge variant="secondary" className="gap-1">
                                      <Clock className="h-3 w-3" />
                                      Em breve
                                    </Badge>
                                  )}
                                  {turma.status === "fechada" && (
                                    <Badge variant="secondary" className="gap-1">
                                      <XCircle className="h-3 w-3" />
                                      Fechada
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {turmasDisponiveis.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {turmasDisponiveis.filter((t: any) => t.podeMatricular).length} turma(s) com vagas disponíveis
                      </p>
                    )}
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                      <p className="text-sm text-amber-900 dark:text-amber-200">
                        <strong>Atenção:</strong> Selecione apenas a turma em que você já está inserido através do grupo de WhatsApp. 
                        Caso escolha uma turma diferente e não faça parte do grupo correspondente, sua matrícula poderá ser reprovada após a análise do diretor.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <div className="relative">
                      <Input
                        id="cep"
                        type="text"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: formatarCEP(e.target.value) })}
                        required
                        maxLength={9}
                        data-testid="input-cep"
                      />
                      {buscandoCep && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rua">Rua *</Label>
                      <Input
                        id="rua"
                        type="text"
                        placeholder="Nome da rua"
                        value={formData.rua}
                        onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                        required
                        data-testid="input-rua"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro *</Label>
                      <Input
                        id="bairro"
                        type="text"
                        placeholder="Nome do bairro"
                        value={formData.bairro}
                        onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                        required
                        data-testid="input-bairro"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade *</Label>
                      <Input
                        id="cidade"
                        type="text"
                        placeholder="Nome da cidade"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        required
                        data-testid="input-cidade"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado *</Label>
                      <Input
                        id="estado"
                        type="text"
                        placeholder="UF"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                        required
                        maxLength={2}
                        data-testid="input-estado"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Disponibilidade de Horário para Estudos *</Label>
                    <div className="space-y-2 p-4 border rounded-lg">
                      {HORARIOS_DISPONIVEIS.map((opcao) => (
                        <div key={opcao} className="flex items-center space-x-2">
                          <Checkbox
                            id={opcao}
                            checked={disponibilidade.includes(opcao)}
                            onCheckedChange={() => toggleDisponibilidade(opcao)}
                            data-testid={`checkbox-disponibilidade-${opcao}`}
                          />
                          <Label htmlFor={opcao} className="font-normal cursor-pointer">
                            {opcao}
                          </Label>
                        </div>
                      ))}
                    </div>
                    
                    {disponibilidade.includes("Horário especial") && (
                      <div className="space-y-2">
                        <Label htmlFor="horario-especial-obs" className="text-sm font-medium">
                          Descrição do Horário Especial *
                        </Label>
                        <Input
                          id="horario-especial-obs"
                          type="text"
                          placeholder="Descreva o horário especial (ex: Terças e quintas das 14h às 16h)"
                          value={horarioEspecialObservacao}
                          onChange={(e) => setHorarioEspecialObservacao(e.target.value)}
                          required
                          data-testid="input-horario-especial-observacao"
                        />
                      </div>
                    )}
                  </div>

                  <PhotoUpload
                    onPhotoChange={(file, base64) => {
                      setPhotoFile(file);
                      setPhotoBase64(base64 || null);
                    }}
                    onPublicChange={setPhotoPublic}
                    required={false}
                  />

                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <strong className="text-destructive">ATENÇÃO:</strong>
                        <p className="mt-1 text-foreground">
                          Novos cadastros passarão por análise do Diretor e serão criados exclusivamente para alunos.
                          Para contas de professor, entre em contato com um administrador da plataforma.
                        </p>
                        <p className="mt-2 text-foreground">
                          Você poderá acompanhar o status da sua solicitação pela interface inicial, utilizando o número de matrícula que será gerado após o envio do cadastro.
                        </p>
                        <p className="mt-2 text-foreground">
                          Após a aprovação da matrícula, é necessário manter presença ativa e alcançar as médias mínimas exigidas em cada bimestre. O descumprimento desses e outros critérios poderá resultar na suspensão definitiva da conta na plataforma e o encerramento da matrícula.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {mode === "login" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="loginId">E-mail, CPF ou matrícula</Label>
                    <Input
                      id="loginId"
                      type="text"
                      placeholder="nome@escola.com, 000.000.000-00 ou 0000"
                      value={formData.loginId}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (rawValue.includes("@") || /[a-zA-Z]/.test(rawValue)) {
                          setFormData({ ...formData, loginId: rawValue });
                          return;
                        }
                        const value = rawValue.replace(/\D/g, '');
                        if (value.length <= 4) {
                          setFormData({ ...formData, loginId: value });
                        } else {
                          setFormData({ ...formData, loginId: formatarCPF(rawValue) });
                        }
                      }}
                      required
                      data-testid="input-login-id"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      data-testid="input-password"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      className="login-text-link text-sm"
                      onClick={() => setMode("forgotPassword")}
                      data-testid="button-forgot-password"
                    >
                      Esqueci a senha
                    </button>
                    <button
                      type="button"
                      className="login-text-link text-sm flex items-center gap-1"
                      onClick={() => setMode("diretorLogin")}
                      data-testid="button-diretor-login"
                    >
                      <Shield className="h-3 w-3" />
                      Login Diretoria
                    </button>
                  </div>
                </>
              )}

              {mode === "diretorLogin" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="diretor-email">Email da Diretoria</Label>
                    <Input
                      id="diretor-email"
                      type="email"
                      placeholder="diretor@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="input-diretor-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="diretor-password">Senha</Label>
                    <Input
                      id="diretor-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      data-testid="input-diretor-password"
                    />
                  </div>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      className="login-text-link text-sm"
                      onClick={() => setMode("login")}
                      data-testid="button-back-to-login"
                    >
                      Voltar ao login normal
                    </button>
                  </div>
                </>
              )}
              
              <Button type="submit" className="w-full login-primary-button" disabled={loading} data-testid="button-submit">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "register" ? "Solicitar Matrícula" : "Entrar"}
              </Button>
            </form>
          )}
          
          {mode === "login" && (
            <Button
              type="button"
              variant="outline"
              className="w-full login-secondary-button"
              onClick={() => {
                setShowStatusDialog(true);
                setStatusError("");
                setStatusResult(null);
                setStatusMatricula("");
              }}
              data-testid="button-verificar-status"
            >
              <Search className="mr-2 h-4 w-4" />
              VERIFICAR STATUS DA MATRÍCULA
            </Button>
          )}
          
          {mode !== "forgotPassword" && (
            <div className="text-center text-sm">
              <button
                type="button"
                className="login-toggle-link"
                onClick={() => setMode(mode === "login" || mode === "diretorLogin" ? "register" : "login")}
                data-testid="button-toggle-mode"
              >
                {mode === "login" || mode === "diretorLogin"
                  ? "NOVO ALUNO? REALIZE SUA MATRÍCULA"
                  : "Já tem uma conta? Faça login"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Status da Matrícula */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verificar Status da Matrícula</DialogTitle>
            <DialogDescription>
              Informe o número da sua matrícula para verificar o status da análise.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-matricula">Matrícula (4 dígitos)</Label>
              <Input
                id="status-matricula"
                type="text"
                placeholder="0000"
                maxLength={4}
                value={statusMatricula}
                onChange={(e) => {
                  setStatusMatricula(e.target.value.replace(/\D/g, ''));
                  setStatusError("");
                }}
                data-testid="input-status-matricula"
              />
            </div>

            {statusError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg" data-testid="text-status-error">
                <p className="text-sm font-medium text-destructive">Matrícula não encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusError}
                </p>
              </div>
            )}

            {statusResult && (
              <div className="p-4 border rounded-lg space-y-3">
                {statusResult.status === "pendente" && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium">Status: Aguardando Análise</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seu cadastro está em análise. Aguarde o retorno da diretoria.
                    </p>
                  </div>
                )}

                {statusResult.status === "aprovado" && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Status: Matrícula Aprovada</p>
                    <p className="text-sm mt-2">
                      Seu cadastro está aprovado. Fale com o professor responsável por sua turma para receber sua senha inicial de acesso.
                    </p>
                  </div>
                )}

                {statusResult.status === "devolvido" && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Status: Cadastro Devolvido</p>
                    <p className="text-sm mt-2">
                      <strong>Motivo:</strong><br />
                      {statusResult.comentarioDevolucao || "Disponível após a confirmação de identidade."}
                    </p>
                    <p className="text-sm mt-3 p-2 bg-background rounded">
                      Seu cadastro foi devolvido para correções. Clique no botão abaixo para editar e reenviar.
                    </p>
                  </div>
                )}

                {statusResult.status === "standby" && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Status: Fila de Espera (Stand By)</p>
                    <p className="text-sm mt-2">
                      {statusResult.comentarioStandby || "Você está em fila de espera. Aguarde avaliação interna."}
                    </p>
                    <p className="text-sm mt-3 p-2 bg-background rounded">
                      Você pode continuar verificando o status para verificar se houve alterações na sua matrícula.
                    </p>
                  </div>
                )}

                {statusResult.status === "reprovado" && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium text-destructive">Status: Reprovado</p>
                    <p className="text-sm mt-2">
                      <strong>Motivo:</strong><br />
                      {statusResult.comentarioReprovacao || "Consulte a secretaria para receber os detalhes com segurança."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {statusResult && statusResult.status === "devolvido" ? (
              <Button
                onClick={() => {
                  setPendingSolicitacao({ matricula: statusResult.matricula || statusMatricula });
                  setConfirmationError("");
                  setShowConfirmationDialog(true);
                }}
                className="w-full"
                data-testid="button-edit-returned"
              >
                Fazer Correção
              </Button>
            ) : (
              <Button
                onClick={handleVerificarStatus}
                className="w-full"
                disabled={statusChecking || !statusMatricula}
                data-testid="button-confirmar-status"
              >
                {statusChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verificar Status
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Reprovação */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Reprovado</DialogTitle>
            <DialogDescription>
              Seu cadastro foi analisado pelo administrador e foi reprovado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                <strong>Motivo:</strong><br />
                {rejectionComment}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Sua solicitação foi reprovada e não pode mais ser editada. Entre em contato com a diretoria para mais informações.
            </p>
            <Button
              onClick={() => {
                setShowRejectionDialog(false);
                setUserToReject(null);
              }}
              className="w-full"
              data-testid="button-close-rejection"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Matrícula Gerada */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitação Enviada com Sucesso</DialogTitle>
            <DialogDescription>
              Sua solicitação de matrícula foi enviada para análise. Guarde sua matrícula para acompanhar o status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Sua Matrícula</p>
                <code className="text-3xl font-bold text-primary" data-testid="text-request-code">
                  {requestCode}
                </code>
              </div>
            </div>
            <Button
              onClick={handleCopyCode}
              className="w-full"
              variant="outline"
              data-testid="button-copy-code"
            >
              {codeCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Matrícula
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowCodeDialog(false)}
              className="w-full"
              data-testid="button-close-dialog"
            >
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overlay de Suspensão Disciplinar */}
      {showSuspensionOverlay && suspensionData && (
        <div 
          className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3"
          style={{ zIndex: 999999 }}
          data-testid="overlay-suspension"
        >
          <Card className="w-full max-w-md border-destructive max-h-[90vh] overflow-auto">
            <CardHeader className="space-y-2 text-center pb-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-destructive">
                SUSPENSÃO DISCIPLINAR
              </CardTitle>
              <CardDescription className="text-sm">
                Aguarde o término da suspensão para retomar suas atividades.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Contador de tempo restante */}
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Tempo restante</p>
                <p className="text-xl font-bold text-destructive font-mono" data-testid="text-suspension-countdown">
                  {suspensionTimeRemaining}
                </p>
              </div>
              
              {/* Informações da suspensão */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Duração</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-suspension-duration">
                      2 dias (48 horas)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Reativação</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-suspension-end">
                      {format(new Date(suspensionData.dataTerminoSuspensao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">Aplicado por</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-suspension-applied-by">
                      Diretoria
                    </p>
                  </div>
                </div>
                
                {suspensionData.comentario && (
                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">Motivo</p>
                      <p className="text-xs text-muted-foreground break-words" data-testid="text-suspension-reason">
                        {suspensionData.comentario}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Aviso */}
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive">
                    Esta suspensão será registrada em seu histórico.
                  </p>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-3">
              <Button
                onClick={async () => {
                  console.log("🔘 Fechando overlay de suspensão");
                  
                  // Fazer logout se estiver autenticado
                  if (auth.currentUser) {
                    try {
                      await auth.signOut();
                      console.log("🔓 Logout realizado");
                    } catch (error) {
                      console.error("Erro ao fazer logout:", error);
                    }
                  }
                  
                  // Limpar estados do overlay
                  setShowSuspensionOverlay(false);
                  setSuspensionData(null);
                  setSuspensionTimeRemaining("");
                }}
                variant="outline"
                className="w-full"
                data-testid="button-close-suspension"
              >
                Fechar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Overlay de Manutenção do Sistema */}
      {showMaintenanceOverlay && maintenanceData && (
        <div 
          className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3"
          style={{ zIndex: 999999 }}
          data-testid="overlay-maintenance"
        >
          <Card className="w-full max-w-md border-orange-500 max-h-[90vh] overflow-auto">
            <CardHeader className="space-y-2 text-center pb-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-xl font-bold text-orange-600">
                Manutenção Programada
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Mensagem principal */}
              <div className="text-sm text-center space-y-2">
                <p>Informamos que o sistema está temporariamente indisponível devido a uma manutenção programada.</p>
                
                <p className="text-muted-foreground text-xs">
                  Durante este período, o acesso a aulas, tarefas, mensagens e demais funcionalidades estarão suspensos.
                </p>
              </div>
              
              {/* Informações de data/hora */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                  <div className="text-lg mt-0.5">📅</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Início:</p>
                    <p className="text-xs text-muted-foreground" data-testid="text-maintenance-start">
                      {formatBrasiliaDateTime(maintenanceData.dataInicio)}
                    </p>
                  </div>
                </div>
                
                {maintenanceData.dataFim ? (
                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg mt-0.5">⏳</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">Previsão de retorno:</p>
                      <p className="text-xs text-muted-foreground" data-testid="text-maintenance-end">
                        {formatBrasiliaDateTime(maintenanceData.dataFim)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className="text-lg mt-0.5">⏳</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">Previsão de retorno:</p>
                      <p className="text-xs text-muted-foreground" data-testid="text-maintenance-duration">
                        Indeterminado
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Mensagem sobre a atualização */}
              <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-xs text-orange-600 text-center">
                  Essa atualização é essencial para garantir mais estabilidade, segurança e desempenho na plataforma.
                </p>
              </div>
              
              {/* Rodapé */}
              <div className="text-center pt-1">
                <p className="text-xs font-medium">Agradecemos pela paciência e colaboração!</p>
                <p className="text-xs text-muted-foreground mt-1">Diretoria - Vestibulando</p>
              </div>
            </CardContent>
            
            <CardFooter className="pt-3">
              <Button
                onClick={async () => {
                  console.log("🔘 Fechando overlay de manutenção");
                  
                  // Fazer logout se estiver autenticado
                  if (auth.currentUser) {
                    try {
                      await auth.signOut();
                      console.log("🔓 Logout realizado");
                    } catch (error) {
                      console.error("Erro ao fazer logout:", error);
                    }
                  }
                  
                  // Limpar estados do overlay
                  setShowMaintenanceOverlay(false);
                  setMaintenanceData(null);
                }}
                variant="outline"
                className="w-full"
                data-testid="button-close-maintenance"
              >
                Voltar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Overlay de Conta Bloqueada */}
      {showBlockedOverlay && (
        <div 
          className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3"
          style={{ zIndex: 999999 }}
          data-testid="overlay-blocked"
        >
          <Card className="w-full max-w-md border-orange-500 max-h-[90vh] overflow-auto">
            <CardHeader className="space-y-2 text-center pb-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-xl font-bold text-orange-600">
                Acesso Bloqueado
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="text-sm space-y-3">
                <p className="font-medium">Seu acesso ao sistema foi bloqueado.</p>
                
                <ul className="space-y-2 text-muted-foreground text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-0.5">•</span>
                    <span>Você não possui permissão para entrar neste momento.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-0.5">•</span>
                    <span>Para mais informações ou regularização, entre em contato com a diretoria ou suporte técnico.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 mt-0.5">•</span>
                    <span>Caso o bloqueio seja temporário, aguarde o prazo informado pela instituição para nova tentativa de login.</span>
                  </li>
                </ul>
              </div>
              
              <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-orange-600">
                    Entre em contato com a diretoria para mais informações.
                  </p>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-3">
              <Button
                onClick={() => {
                  console.log("🔘 Fechando overlay de bloqueio");
                  setShowBlockedOverlay(false);
                }}
                variant="outline"
                className="w-full"
                data-testid="button-close-blocked"
              >
                Voltar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Overlay de Conta Desativada */}
      {showDeactivatedOverlay && (
        <div 
          className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center p-3"
          style={{ zIndex: 999999 }}
          data-testid="overlay-deactivated"
        >
          <Card className="w-full max-w-md border-slate-500 max-h-[90vh] overflow-auto">
            <CardHeader className="space-y-2 text-center pb-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center">
                <PowerOff className="h-6 w-6 text-slate-600" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-600">
                Conta Desativada
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="text-sm space-y-3">
                <p className="font-medium">Sua conta foi desativada pela instituição.</p>
                
                <ul className="space-y-2 text-muted-foreground text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">•</span>
                    <span>Seu cadastro não está mais ativo no sistema Vestibulando.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">•</span>
                    <span>Isso pode ocorrer por término de vínculo, transferência ou solicitação administrativa.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-600 mt-0.5">•</span>
                    <span>Se você acredita que isso é um erro, entre em contato com a secretaria.</span>
                  </li>
                </ul>
              </div>
              
              <div className="p-2 bg-slate-500/10 border border-slate-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600">
                    Para reativação, procure a secretaria com documentação necessária.
                  </p>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-3">
              <Button
                onClick={() => {
                  console.log("🔘 Fechando overlay de desativação");
                  setShowDeactivatedOverlay(false);
                }}
                variant="outline"
                className="w-full"
                data-testid="button-close-deactivated"
              >
                Voltar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Dialog de Troca de Senha Obrigatória (Primeiro Acesso) */}
      <Dialog open={showPasswordChangeDialog} onOpenChange={async (open) => {
        if (!open) {
          // Fazer logout e voltar para tela inicial
          if (auth.currentUser) {
            try {
              await auth.signOut();
              console.log("🔓 Logout realizado - fechamento do diálogo de primeiro acesso");
            } catch (error) {
              console.error("Erro ao fazer logout:", error);
            }
          }
          
          // Limpar estados
          setShowPasswordChangeDialog(false);
          setNewPassword("");
          setConfirmNewPassword("");
          setPasswordChangeError("");
          
          toast({
            title: "Acesso cancelado",
            description: "Você precisará alterar sua senha no próximo login.",
            variant: "default",
          });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Alterar Senha - Primeiro Acesso
            </DialogTitle>
            <DialogDescription>
              Por questões de segurança, você deve alterar sua senha antes de acessar o sistema pela primeira vez.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha *</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordChangeError("");
                }}
                required
                minLength={10}
                data-testid="input-new-password"
              />
              <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres, com maiúscula, minúscula e número</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha *</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Digite novamente sua nova senha"
                value={confirmNewPassword}
                onChange={(e) => {
                  setConfirmNewPassword(e.target.value);
                  setPasswordChangeError("");
                }}
                required
                minLength={10}
                data-testid="input-confirm-password"
              />
            </div>
            
            {passwordChangeError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg" data-testid="error-password-change">
                <p className="text-sm font-medium text-destructive">Erro</p>
                <p className="text-sm text-destructive/90 mt-1">{passwordChangeError}</p>
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={passwordChangeLoading || !newPassword || !confirmNewPassword}
              data-testid="button-change-password"
            >
              {passwordChangeLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando senha...
                </>
              ) : (
                "Alterar Senha e Continuar"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Autenticação em duas etapas por aplicativo TOTP */}
      <Dialog open={showMfaDialog} onOpenChange={(open) => {
        setShowMfaDialog(open);
        if (!open) {
          setMfaResolver(null);
          setMfaCode("");
          setMfaError("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Verificação em duas etapas</DialogTitle>
            <DialogDescription>Abra seu aplicativo autenticador e informe o código temporário de 6 dígitos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMfaVerification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código de segurança</Label>
              <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => { setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setMfaError(""); }} placeholder="000000" className="text-center text-xl tracking-[0.35em]" autoFocus />
            </div>
            {mfaError && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{mfaError}</div>}
            <Button type="submit" className="w-full" disabled={mfaLoading || mfaCode.length !== 6}>{mfaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}Confirmar código</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Identidade */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirme sua Identidade</DialogTitle>
            <DialogDescription>
              Para fazer correções no seu cadastro, confirme seu CPF e data de nascimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-cpf">CPF *</Label>
              <Input
                id="confirm-cpf"
                type="text"
                placeholder="000.000.000-00"
                value={confirmationData.cpf}
                onChange={(e) => {
                  setConfirmationData({ ...confirmationData, cpf: formatarCPF(e.target.value) });
                  setConfirmationError("");
                }}
                maxLength={14}
                data-testid="input-confirm-cpf"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-nascimento">Data de Nascimento *</Label>
              <Input
                id="confirm-nascimento"
                type="date"
                value={confirmationData.dataNascimento}
                onChange={(e) => {
                  setConfirmationData({ ...confirmationData, dataNascimento: e.target.value });
                  setConfirmationError("");
                }}
                data-testid="input-confirm-nascimento"
              />
            </div>
            
            {confirmationError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg" data-testid="error-confirmation">
                <p className="text-sm font-medium text-destructive">Dados incorretos</p>
                <p className="text-sm text-destructive/90 mt-1">{confirmationError}</p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowConfirmationDialog(false);
                  setConfirmationData({ cpf: "", dataNascimento: "" });
                  setPendingSolicitacao(null);
                  setConfirmationError("");
                }}
                variant="outline"
                className="flex-1"
                data-testid="button-cancel-confirmation"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmIdentity}
                className="flex-1"
                disabled={statusChecking || !confirmationData.cpf || !confirmationData.dataNascimento}
                data-testid="button-confirm-identity"
              >
                {statusChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
