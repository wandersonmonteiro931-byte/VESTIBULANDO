import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GraduationCap, Loader2, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

async function generateUniqueRequestCode(): Promise<string> {
  const { collection, query, where, getDocs } = await import("firebase/firestore");
  
  while (true) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    const q = query(collection(db, "usuarios"), where("codigoSolicitacao", "==", code));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return code;
    }
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
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    turma: "",
  });

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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDoc = await getDoc(doc(db, "usuarios", result.user.uid));
      
      if (!userDoc.exists()) {
        const codigo = await generateUniqueRequestCode();
        const dataSolicitacao = new Date().toISOString();
        
        await setDoc(doc(db, "usuarios", result.user.uid), {
          uid: result.user.uid,
          nome: result.user.displayName || "Usuário",
          email: result.user.email || "",
          tipo: "aluno",
          turma: formData.turma || "",
          ativo: true,
          status: "pendente",
          codigoSolicitacao: codigo,
          dataSolicitacao: dataSolicitacao,
        });

        await auth.signOut();
        
        setRequestCode(codigo);
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
        if (!formData.nome) {
          toast({
            title: "Nome obrigatório",
            description: "Por favor, preencha seu nome completo",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        if (userType === "aluno" && !formData.turma) {
          toast({
            title: "Turma obrigatória",
            description: "Por favor, informe sua turma",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        const codigo = await generateUniqueRequestCode();
        const dataSolicitacao = new Date().toISOString();
        
        setDoc(doc(db, "usuarios", userCredential.user.uid), {
          uid: userCredential.user.uid,
          nome: formData.nome,
          email: formData.email,
          tipo: "aluno",
          turma: formData.turma || "",
          ativo: true,
          status: "pendente",
          codigoSolicitacao: codigo,
          dataSolicitacao: dataSolicitacao,
        }).catch((error) => {
          console.error("Erro ao salvar no Firestore:", error);
        });
        
        setRequestCode(codigo);
        setMode("login");
        setFormData({ email: "", password: "", nome: "", turma: "" });
        setCodeCopied(false);
        
        await auth.signOut();
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
        title: "Código copiado!",
        description: "O código foi copiado para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o código.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md shadow-lg">
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
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
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
            )}
            
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
                Novos cadastros são criados como <strong>Aluno</strong> e precisam de aprovação do administrador para acessar a plataforma.
              </div>
            )}
            
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="turma">Turma</Label>
                <Input
                  id="turma"
                  type="text"
                  placeholder="Ex: 3A, 2B"
                  value={formData.turma}
                  onChange={(e) => setFormData({ ...formData, turma: e.target.value })}
                  required
                  data-testid="input-turma"
                />
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "register" ? "Criar Conta" : "Entrar"}
            </Button>
          </form>
          
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

      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro Enviado para Análise</DialogTitle>
            <DialogDescription>
              Seu cadastro foi enviado para análise do diretor. Guarde seu código único para acompanhar sua solicitação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
              <code className="text-2xl font-bold text-primary" data-testid="text-request-code">
                {requestCode}
              </code>
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
                  Copiar Código
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
