import { useState } from "react";
import { useLocation } from "wouter";
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [userType, setUserType] = useState<"aluno" | "professor" | "admin">("aluno");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    turma: "",
  });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDoc = await getDoc(doc(db, "usuarios", result.user.uid));
      
      if (!userDoc.exists()) {
        await setDoc(doc(db, "usuarios", result.user.uid), {
          uid: result.user.uid,
          nome: result.user.displayName || "Usuário",
          email: result.user.email || "",
          tipo: "aluno",
          turma: formData.turma || "",
          ativo: true,
        });
      }
      
      await refreshUserData();
      
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo à Plataforma ENEM+",
      });
      
      const userData = userDoc.exists() ? userDoc.data() : { tipo: userType };
      redirectByUserType(userData.tipo);
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
        
        await setDoc(doc(db, "usuarios", userCredential.user.uid), {
          uid: userCredential.user.uid,
          nome: formData.nome,
          email: formData.email,
          tipo: "aluno",
          turma: formData.turma || "",
          ativo: true,
        });
        
        toast({
          title: "Conta criada com sucesso!",
          description: "Bem-vindo à Plataforma ENEM+",
        });
      } else {
        userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta!",
        });
      }
      
      await refreshUserData();
      
      const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));
      const userData = userDoc.data();
      
      if (userData) {
        redirectByUserType(userData.tipo);
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

  const redirectByUserType = (tipo: string) => {
    switch (tipo) {
      case "aluno":
        setLocation("/aluno");
        break;
      case "professor":
        setLocation("/professor");
        break;
      case "admin":
        setLocation("/admin");
        break;
      default:
        setLocation("/");
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
                Novos cadastros são criados como <strong>Aluno</strong>. Para contas de Professor ou Administrador, contate um administrador da plataforma.
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
    </div>
  );
}
