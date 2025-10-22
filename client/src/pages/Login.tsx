import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GraduationCap, Loader2, Copy, Check, Search, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Gera uma matrícula única de 4 dígitos verificando duplicatas
async function generateUniqueMatricula(db: any): Promise<string> {
  const { collection, getDocs, query, where } = await import("firebase/firestore");
  
  let tentativas = 0;
  const maxTentativas = 20;
  
  while (tentativas < maxTentativas) {
    const matricula = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Verificar se já existe nas solicitações
    const solicitacoesSnapshot = await getDocs(
      query(collection(db, "solicitacoes"), where("matricula", "==", matricula))
    );
    
    // Verificar se já existe nos usuários
    const usuariosSnapshot = await getDocs(
      query(collection(db, "usuarios"), where("matricula", "==", matricula))
    );
    
    if (solicitacoesSnapshot.empty && usuariosSnapshot.empty) {
      return matricula;
    }
    
    tentativas++;
  }
  
  // Se não encontrar uma matrícula única após várias tentativas, gera com timestamp
  const timestamp = Date.now().toString().slice(-4);
  return timestamp;
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [userType, setUserType] = useState<"aluno" | "professor" | "admin">("aluno");
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
    email: "",
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
  });
  
  const [disponibilidade, setDisponibilidade] = useState<string[]>([]);

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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDoc = await getDoc(doc(db, "usuarios", result.user.uid));
      
      if (!userDoc.exists()) {
        const matricula = await generateUniqueMatricula(db);
        const dataSolicitacao = new Date().toISOString();
        
        await setDoc(doc(db, "usuarios", result.user.uid), {
          uid: result.user.uid,
          nome: result.user.displayName || "Usuário",
          email: result.user.email || "",
          tipo: "aluno",
          turma: formData.turma || "",
          ativo: true,
          status: "pendente",
          matricula: matricula,
          dataSolicitacao: dataSolicitacao,
        });

        await auth.signOut();
        
        setRequestCode(matricula);
        setShowCodeDialog(true);
        setCodeCopied(false);
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      
      if (userData.status === "reprovado") {
        toast({
          title: "Acesso negado",
          description: "Sua conta foi reprovada pelo administrador. Entre em contato para mais informações.",
          variant: "destructive",
        });
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      if (userData.status === "pendente") {
        toast({
          title: "Conta pendente",
          description: "Sua conta está aguardando aprovação do administrador.",
          variant: "destructive",
        });
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      await refreshUserData();
      
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo à Plataforma ENEM+",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userCredential;
      
      if (mode === "register") {
        // Validações para registro
        if (!formData.nome || !formData.dataNascimento || !formData.cpf || 
            !formData.escolaridade || !formData.telefone || !formData.turma || 
            !formData.cep || !formData.rua || !formData.bairro || 
            !formData.cidade || !formData.estado || disponibilidade.length === 0) {
          toast({
            title: "Campos obrigatórios",
            description: "Por favor, preencha todos os campos obrigatórios, incluindo endereço completo",
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
          email: "", 
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
        });
        setDisponibilidade([]);
        setCodeCopied(false);
        setLoading(false);
        
        setTimeout(() => {
          setShowCodeDialog(true);
        }, 100);
        
        return;
      } else {
        userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));
        const userData = userDoc.data();
        
        if (!userData) {
          toast({
            title: "Erro",
            description: "Dados do usuário não encontrados",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (userData.status === "reprovado") {
          toast({
            title: "Acesso negado",
            description: "Sua conta foi reprovada pelo administrador. Entre em contato para mais informações.",
            variant: "destructive",
          });
          await auth.signOut();
          setLoading(false);
          return;
        }
        
        if (userData.status === "pendente") {
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
      if (mode === "login" && (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential")) {
        try {
          const { getDocs, query, collection, where } = await import("firebase/firestore");
          const reprovacaoSnapshot = await getDocs(query(collection(db, "reprovacoes"), where("email", "==", formData.email)));
          
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
      }
      
      let message = "Ocorreu um erro. Tente novamente.";
      if (error.code === "auth/email-already-in-use") {
        message = "Este email já está em uso";
      } else if (error.code === "auth/weak-password") {
        message = "A senha deve ter pelo menos 6 caracteres";
      } else if (error.code === "auth/invalid-email") {
        message = "Email inválido";
      } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        message = "Email ou senha incorretos";
      } else if (error.code === "auth/invalid-credential") {
        message = "Email ou senha incorretos";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <GraduationCap className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">ENEM+</CardTitle>
            <CardDescription className="mt-2">
              {mode === "register" ? "Criar nova conta" : "Entre na sua conta"}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "register" && (
              <>
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
                    <Input
                      id="cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatarCPF(e.target.value) })}
                      required
                      maxLength={14}
                      data-testid="input-cpf"
                    />
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
                        <SelectItem value="fundamental">Ensino Fundamental</SelectItem>
                        <SelectItem value="medio">Ensino Médio</SelectItem>
                        <SelectItem value="superior">Ensino Superior</SelectItem>
                        <SelectItem value="pos">Pós-graduação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone (WhatsApp) *</Label>
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
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
                      <SelectValue placeholder="Selecione uma turma com vagas" />
                    </SelectTrigger>
                    <SelectContent>
                      {turmasDisponiveis.length === 0 ? (
                        <SelectItem value="none" disabled>Nenhuma turma disponível</SelectItem>
                      ) : (
                        turmasDisponiveis.map(turma => (
                          <SelectItem key={turma.id} value={turma.nome}>
                            {turma.nome} ({turma.vagasDisponiveis || 0} vagas)
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
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      required
                      data-testid="input-cep"
                    />
                    {buscandoCep && (
                      <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rua">Rua *</Label>
                    <Input
                      id="rua"
                      type="text"
                      value={formData.rua}
                      onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                      disabled={buscandoCep}
                      required
                      data-testid="input-rua"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro *</Label>
                    <Input
                      id="bairro"
                      type="text"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      disabled={buscandoCep}
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
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      disabled={buscandoCep}
                      required
                      data-testid="input-cidade"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado *</Label>
                    <Input
                      id="estado"
                      type="text"
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      disabled={buscandoCep}
                      maxLength={2}
                      required
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
                        Após aprovação da matrícula, é necessário ter presença ativa e manter as notas dentro das médias indicadas em cada bimestre, caso contrário, o aluno pode ter sua conta suspensa da plataforma.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {mode === "login" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
            )}
            
            {mode === "login" && (
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
            )}
            
            {mode === "login" && (
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <RadioGroup value={userType} onValueChange={(v) => setUserType(v as any)} data-testid="radio-user-type">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="aluno" id="aluno" />
                    <Label htmlFor="aluno" className="font-normal cursor-pointer">Aluno</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="professor" id="professor" />
                    <Label htmlFor="professor" className="font-normal cursor-pointer">Professor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="admin" />
                    <Label htmlFor="admin" className="font-normal cursor-pointer">Administrador</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            {mode === "register" && (
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                Sua solicitação será enviada para análise do administrador. Após a aprovação, você receberá suas credenciais de acesso.
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "register" ? "Criar Conta" : "Entrar"}
            </Button>
          </form>
          
          {mode === "login" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowStatusDialog(true)}
              data-testid="button-verificar-status"
            >
              <Search className="mr-2 h-4 w-4" />
              Verificar Status da Análise de Cadastro
            </Button>
          )}
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
            </div>
          </div>
          
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
            data-testid="button-google-signin"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>
          
          <div className="text-center text-sm">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              data-testid="button-toggle-mode"
            >
              {mode === "login"
                ? "Não tem uma conta? Cadastre-se"
                : "Já tem uma conta? Faça login"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Status da Matrícula */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verificar Status da Análise</DialogTitle>
            <DialogDescription>
              Informe o número da sua matrícula para verificar o status da análise do seu cadastro.
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
            <DialogTitle>Cadastro Enviado para Análise</DialogTitle>
            <DialogDescription>
              Seu cadastro foi enviado para análise do administrador. Guarde sua matrícula para acompanhar sua solicitação.
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
