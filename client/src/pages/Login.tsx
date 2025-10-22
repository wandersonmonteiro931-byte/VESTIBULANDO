import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GraduationCap, Loader2, Copy, Check, Search, AlertCircle, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Gera uma matrícula sequencial única usando transação atômica
async function generateUniqueMatricula(db: any): Promise<string> {
  const { doc, runTransaction, getDoc } = await import("firebase/firestore");
  
  // Usar transação para garantir atomicidade
  const matricula = await runTransaction(db, async (transaction) => {
    const contadorRef = doc(db, "system", "matriculaCounter");
    const contadorDoc = await transaction.get(contadorRef);
    
    let proximaMatricula = 100; // Valor inicial: 0100
    
    if (contadorDoc.exists()) {
      const data = contadorDoc.data();
      proximaMatricula = (data.ultimaMatricula || 99) + 1;
    }
    
    // Atualizar o contador atomicamente
    transaction.set(contadorRef, { 
      ultimaMatricula: proximaMatricula,
      ultimaAtualizacao: new Date().toISOString()
    });
    
    // Garantir que a matrícula tenha 4 dígitos
    return proximaMatricula.toString().padStart(4, '0');
  });
  
  return matricula;
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
  const limitado = apenasNumeros.slice(0, 11);
  
  if (limitado.length <= 2) return limitado;
  if (limitado.length <= 7) return `(${limitado.slice(0, 2)})${limitado.slice(2)}`;
  return `(${limitado.slice(0, 2)})${limitado.slice(2, 7)}-${limitado.slice(7)}`;
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "forgotPassword" | "adminLogin">("login");
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [requestCode, setRequestCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionComment, setRejectionComment] = useState("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusMatricula, setStatusMatricula] = useState("");
  const [statusChecking, setStatusChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<any[]>([]);
  const [buscandoCep, setBuscandoCep] = useState(false);
  
  const [formData, setFormData] = useState({
    loginId: "", // CPF ou Matrícula
    password: "",
    nome: "",
    turma: "",
    dataNascimento: "",
    cpf: "",
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
  const [userDataForReset, setUserDataForReset] = useState<any>(null);
  
  const [disponibilidade, setDisponibilidade] = useState<string[]>([]);
  const [cpfValido, setCpfValido] = useState<boolean | null>(null);

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
    if (userData && !showCodeDialog) {
      switch (userData.tipo) {
        case "aluno":
          setLocation("/aluno");
          break;
        case "professor":
          setLocation("/professor");
          break;
        case "admin":
          setLocation("/admin");
          break;
      }
    }
  }, [userData, showCodeDialog, setLocation]);

  // Carregar turmas disponíveis
  useEffect(() => {
    const carregarTurmas = async () => {
      try {
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        const turmasQuery = query(collection(db, "turmas"), where("ativa", "==", true));
        const turmasSnapshot = await getDocs(turmasQuery);
        const turmas = turmasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data() as any
        }));
        setTurmasDisponiveis(turmas.filter((t: any) => (t.vagasDisponiveis || 0) > 0));
      } catch (error) {
        console.error("Erro ao carregar turmas:", error);
      }
    };
    
    if (mode === "register") {
      carregarTurmas();
    }
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "register") {
        // Validações para registro
        if (!formData.nome || !formData.dataNascimento || !formData.cpf || 
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
        
        const matricula = await generateUniqueMatricula(db);
        const dataSolicitacao = new Date().toISOString();
        
        const { collection, addDoc, getDocs, query, where, deleteDoc } = await import("firebase/firestore");
        
        try {
          const reprovacaoSnapshot = await getDocs(query(collection(db, "reprovacoes"), where("email", "==", formData.email)));
          
          if (!reprovacaoSnapshot.empty) {
            for (const docRef of reprovacaoSnapshot.docs) {
              await deleteDoc(doc(db, "reprovacoes", docRef.id));
            }
          }
          
          await addDoc(collection(db, "solicitacoes"), {
            nome: formData.nome,
            email: formData.email,
            tipo: "aluno",
            turma: formData.turma,
            status: "pendente",
            matricula: matricula,
            dataSolicitacao: dataSolicitacao,
            dataNascimento: formData.dataNascimento,
            cpf: formData.cpf,
            escolaridade: formData.escolaridade,
            telefone: formData.telefone,
            cep: formData.cep,
            rua: formData.rua,
            bairro: formData.bairro,
            cidade: formData.cidade,
            estado: formData.estado,
            disponibilidade: disponibilidade,
          });
        } catch (firestoreError: any) {
          console.error("Erro ao salvar solicitação:", firestoreError);
          
          toast({
            title: "Erro ao criar solicitação",
            description: "Não foi possível enviar sua solicitação. Tente novamente.",
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
        setCodeCopied(false);
        setLoading(false);
        
        setTimeout(() => {
          setShowCodeDialog(true);
        }, 100);
        
        return;
      } else if (mode === "adminLogin") {
        // Login de administrador usando email e senha diretamente
        if (!formData.email || !formData.password) {
          toast({
            title: "Campos obrigatórios",
            description: "Por favor, informe email e senha",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));
        const currentUserData = userDoc.data();
        
        if (!currentUserData) {
          toast({
            title: "Erro",
            description: "Dados do usuário não encontrados",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (currentUserData.tipo !== "admin") {
          toast({
            title: "Acesso negado",
            description: "Esta área é restrita a administradores",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        await refreshUserData();
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo, administrador!",
        });
      } else {
        // Login usando CPF ou Matrícula
        const loginIdentifier = formData.loginId.replace(/\D/g, '');
        
        // Buscar usuário pelo CPF ou Matrícula
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        let userSnapshot;
        
        // Tentar buscar por CPF primeiro (11 dígitos)
        if (loginIdentifier.length === 11) {
          userSnapshot = await getDocs(query(collection(db, "usuarios"), where("cpf", "==", formatarCPF(loginIdentifier))));
        } else if (loginIdentifier.length === 4) {
          // Buscar por matrícula (4 dígitos)
          userSnapshot = await getDocs(query(collection(db, "usuarios"), where("matricula", "==", loginIdentifier)));
        } else {
          toast({
            title: "Credenciais inválidas",
            description: "Por favor, informe um CPF (11 dígitos) ou Matrícula (4 dígitos) válidos",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        if (userSnapshot.empty) {
          // Verificar se há reprovação
          try {
            const reprovacaoSnapshot = await getDocs(query(collection(db, "reprovacoes"), where("cpf", "==", formatarCPF(loginIdentifier))));
            
            if (!reprovacaoSnapshot.empty) {
              const reprovacaoData = reprovacaoSnapshot.docs[0].data();
              setRejectionComment(reprovacaoData.comentario || "Sua solicitação foi reprovada pelo administrador.");
              setShowRejectionDialog(true);
              setLoading(false);
              return;
            }
          } catch (checkError) {
            console.error("Erro ao verificar reprovação:", checkError);
          }
          
          toast({
            title: "Usuário não encontrado",
            description: "Não foi encontrado nenhum usuário com estas credenciais",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        const userData = userSnapshot.docs[0].data();
        const userEmail = userData.email;
        
        if (!userEmail) {
          toast({
            title: "Erro",
            description: "Email não encontrado para este usuário",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // Tentar fazer login com email e senha
        const userCredential = await signInWithEmailAndPassword(auth, userEmail, formData.password);
        
        const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));
        const currentUserData = userDoc.data();
        
        if (!currentUserData) {
          toast({
            title: "Erro",
            description: "Dados do usuário não encontrados",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (currentUserData.status === "reprovado") {
          toast({
            title: "Acesso negado",
            description: "Sua conta foi reprovada pelo administrador. Entre em contato para mais informações.",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (currentUserData.status === "pendente") {
          toast({
            title: "Conta pendente",
            description: "Sua conta ainda está aguardando aprovação do administrador.",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        await refreshUserData();
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta!",
        });
      }
    } catch (error: any) {
      let message = "Ocorreu um erro. Tente novamente.";
      if (error.code === "auth/wrong-password") {
        message = "Senha incorreta";
      } else if (error.code === "auth/invalid-credential") {
        message = "CPF/Matrícula ou senha incorretos";
      } else if (error.code) {
        message = `${error.code}: ${error.message}`;
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (forgotPasswordStep === 1) {
      // Passo 1: Buscar usuário pelo CPF
      setLoading(true);
      
      try {
        const cpfFormatted = formatarCPF(forgotPasswordData.cpf);
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        
        const userSnapshot = await getDocs(
          query(collection(db, "usuarios"), where("cpf", "==", cpfFormatted))
        );
        
        if (userSnapshot.empty) {
          toast({
            title: "CPF não encontrado",
            description: "Não foi encontrado nenhum usuário com este CPF",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        const userData = userSnapshot.docs[0];
        setUserDataForReset({ id: userData.id, ...userData.data() });
        setForgotPasswordStep(2);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar CPF:", error);
        toast({
          title: "Erro",
          description: "Não foi possível verificar o CPF. Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
      }
    } else if (forgotPasswordStep === 2) {
      // Passo 2: Verificar informações do usuário e enviar email de recuperação
      if (!userDataForReset) {
        toast({
          title: "Erro",
          description: "Dados do usuário não encontrados",
          variant: "destructive",
        });
        return;
      }
      
      // Verificar se os dados conferem
      const nomeConferido = forgotPasswordData.nomeCompleto.trim().toLowerCase() === userDataForReset.nome.trim().toLowerCase();
      const dataNascimentoConferida = forgotPasswordData.dataNascimento === userDataForReset.dataNascimento;
      const emailConferido = forgotPasswordData.email.trim().toLowerCase() === userDataForReset.email.trim().toLowerCase();
      
      if (!nomeConferido || !dataNascimentoConferida || !emailConferido) {
        toast({
          title: "Dados incorretos",
          description: "As informações fornecidas não conferem com os dados cadastrados. Verifique e tente novamente.",
          variant: "destructive",
        });
        return;
      }
      
      // Dados conferidos - enviar email de recuperação
      setLoading(true);
      
      try {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        await sendPasswordResetEmail(auth, userDataForReset.email);
        
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
        setUserDataForReset(null);
      } catch (resetError: any) {
        console.error("Erro ao enviar email:", resetError);
        
        let errorMessage = "Não foi possível enviar o email de recuperação. Tente novamente mais tarde.";
        
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
      toast({
        title: "Matrícula inválida",
        description: "Por favor, informe uma matrícula válida de 4 dígitos",
        variant: "destructive",
      });
      return;
    }

    setStatusChecking(true);
    setStatusResult(null);

    try {
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      
      // Buscar nas solicitações
      const solicitacoesSnapshot = await getDocs(
        query(collection(db, "solicitacoes"), where("matricula", "==", statusMatricula))
      );
      
      if (!solicitacoesSnapshot.empty) {
        const solicitacao = solicitacoesSnapshot.docs[0].data();
        setStatusResult(solicitacao);
        setStatusChecking(false);
        return;
      }

      // Buscar nos usuários aprovados
      const usuariosSnapshot = await getDocs(
        query(collection(db, "usuarios"), where("matricula", "==", statusMatricula))
      );
      
      if (!usuariosSnapshot.empty) {
        const usuario = usuariosSnapshot.docs[0].data();
        setStatusResult(usuario);
        setStatusChecking(false);
        return;
      }

      // Não encontrou
      toast({
        title: "Matrícula não encontrada",
        description: "Não foi encontrada nenhuma solicitação com esta matrícula.",
        variant: "destructive",
      });
      setStatusChecking(false);
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      toast({
        title: "Erro ao verificar",
        description: "Não foi possível verificar o status. Tente novamente.",
        variant: "destructive",
      });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-2xl shadow-xl border-primary/10 relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="space-y-6 text-center pb-8">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg shadow-primary/20">
              <GraduationCap className="h-14 w-14 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">ENEM+</CardTitle>
            <CardDescription className="text-base">
              {mode === "register" ? "Formulário de Solicitação de Matrícula" : mode === "forgotPassword" ? "Recuperar Senha" : mode === "adminLogin" ? "Login de Administrador" : "Seja Bem-Vindo! Faça Login com sua Matrícula ou CPF"}
            </CardDescription>
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
                  className="text-primary hover:underline text-sm"
                  onClick={() => {
                    setMode("login");
                    setForgotPasswordStep(1);
                    setForgotPasswordData({
                      cpf: "",
                      nomeCompleto: "",
                      dataNascimento: "",
                      email: "",
                    });
                    setUserDataForReset(null);
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
                        maxLength={14}
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
                      required
                      data-testid="input-email"
                    />
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
                            <SelectItem key={turma.id} value={turma.id}>
                              {turma.nome} - {turma.vagasDisponiveis} vagas
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
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
                      {[
                        "Manhã - Seg a Sex",
                        "Manhã - Seg a Sáb",
                        "Tarde - Seg a Sex",
                        "Tarde - Seg a Sáb",
                        "Noite - Seg a Sex",
                        "Noite - Seg a Sáb",
                        "Domingo",
                        "Qualquer Horário"
                      ].map((opcao) => (
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
                  </div>

                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <strong className="text-destructive">ATENÇÃO:</strong>
                        <p className="mt-1 text-foreground">
                          Novos cadastros passarão por análise do Diretor e serão criados apenas para Alunos. Para contas de Professor, entre em contato com um administrador da plataforma.
                        </p>
                        <p className="mt-2 text-foreground">
                          Acompanhe sua solicitação através da interface inicial, com o número da sua matrícula que será gerado após o cadastro.
                        </p>
                        <p className="mt-2 text-foreground">
                          Após aprovação da matrícula, é necessário ter presença ativa e manter as notas dentro das médias indicadas em cada bimestre, caso contrário, o aluno pode ter sua conta suspensa da plataforma.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {mode === "login" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="loginId">CPF ou Matrícula</Label>
                    <Input
                      id="loginId"
                      type="text"
                      placeholder="000.000.000-00 ou 0000"
                      value={formData.loginId}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 4) {
                          setFormData({ ...formData, loginId: value });
                        } else {
                          setFormData({ ...formData, loginId: formatarCPF(e.target.value) });
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
                      className="text-primary hover:underline text-sm"
                      onClick={() => setMode("forgotPassword")}
                      data-testid="button-forgot-password"
                    >
                      Esqueci a senha
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline text-sm flex items-center gap-1"
                      onClick={() => setMode("adminLogin")}
                      data-testid="button-admin-login"
                    >
                      <Shield className="h-3 w-3" />
                      Login Admin
                    </button>
                  </div>
                </>
              )}

              {mode === "adminLogin" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email do Administrador</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="input-admin-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Senha</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      data-testid="input-admin-password"
                    />
                  </div>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-primary hover:underline text-sm"
                      onClick={() => setMode("login")}
                      data-testid="button-back-to-login"
                    >
                      Voltar ao login normal
                    </button>
                  </div>
                </>
              )}
              
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "register" ? "Solicitar Matrícula" : "Entrar"}
              </Button>
            </form>
          )}
          
          {mode === "login" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowStatusDialog(true)}
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
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "login" || mode === "adminLogin" ? "register" : "login")}
                data-testid="button-toggle-mode"
              >
                {mode === "login" || mode === "adminLogin"
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
                onChange={(e) => setStatusMatricula(e.target.value.replace(/\D/g, ''))}
                data-testid="input-status-matricula"
              />
            </div>

            {statusResult && (
              <div className="p-4 border rounded-lg space-y-3">
                {statusResult.status === "pendente" && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium">Status: Aguardando Análise</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seu cadastro está em análise. Aguarde o retorno do administrador.
                    </p>
                  </div>
                )}

                {statusResult.status === "aprovado" && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Status: Aprovado ✓</p>
                    <p className="text-sm mt-2">
                      <strong>Parabéns!</strong> Sua matrícula foi aprovada.
                    </p>
                    <p className="text-sm mt-2 p-2 bg-background rounded">
                      Por favor, procure o professor responsável pela turma para conseguir sua primeira senha de acesso à plataforma.
                    </p>
                  </div>
                )}

                {statusResult.status === "reprovado" && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm font-medium text-destructive">Status: Reprovado</p>
                    <p className="text-sm mt-2">
                      <strong>Motivo:</strong><br />
                      {statusResult.comentarioReprovacao || "Não informado"}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleVerificarStatus}
              className="w-full"
              disabled={statusChecking || !statusMatricula}
              data-testid="button-confirmar-status"
            >
              {statusChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar Status
            </Button>
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
              Você pode se cadastrar novamente com as informações corretas.
            </p>
            <Button
              onClick={() => {
                setShowRejectionDialog(false);
                setMode("register");
              }}
              className="w-full"
              data-testid="button-recadastrar"
            >
              Fazer Novo Cadastro
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
    </div>
  );
}
