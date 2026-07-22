import { useEffect, useRef } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SuspensionAlertProvider } from "@/contexts/SuspensionAlertContext";
import { WarningAlertProvider } from "@/contexts/WarningAlertContext";
import { LiveClassProvider } from "@/contexts/LiveClassContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FirebaseErrorScreen } from "@/components/FirebaseErrorScreen";
import { SuspensionAlertOverlay } from "@/components/SuspensionAlertOverlay";
import { WarningAlertOverlay } from "@/components/WarningAlertOverlay";
import { MfaRequiredOverlay } from "@/components/MfaRequiredOverlay";
import { AccessibilityPreferencesLoader } from "@/components/AccessibilityControls";
import Login from "@/pages/Login";
import StudentDashboard from "@/pages/StudentDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import ChatPage from "@/pages/ChatPage";
import ChatConversationPage from "@/pages/ChatConversationPage";
import LiveClassPage from "@/pages/LiveClassPage";
import TeacherClassroomPage from "@/pages/TeacherClassroomPage";
import StudentClassroomPage from "@/pages/StudentClassroomPage";
import SchoolPlatformPage from "@/pages/SchoolPlatformPage";
import DocumentValidationPage from "@/pages/DocumentValidationPage";
import FirestoreFilePage from "@/pages/FirestoreFilePage";
import NotFound from "@/pages/not-found";
import type { User } from "@shared/schema";

function BrowserRedirect({ to }: { to: string }) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || window.location.pathname === to) return;
    startedRef.current = true;
    window.location.replace(to);
  }, [to]);

  return null;
}

function RootRedirect() {
  const auth = useAuth();
  const userData: User | null = (auth && typeof auth === 'object' && 'userData' in auth) ? (auth.userData as User | null) : null;
  const loading = (auth && typeof auth === 'object' && 'loading' in auth) ? auth.loading : true;

  if (loading) {
    return null;
  }

  if (!userData) {
    return <BrowserRedirect to="/login" />;
  }

  switch (userData.tipo) {
    case "aluno":
      return <BrowserRedirect to="/aluno" />;
    case "professor":
      return <BrowserRedirect to="/professor" />;
    case "diretor":
      return <BrowserRedirect to="/diretor" />;
    case "responsavel":
    case "funcionario":
      return <BrowserRedirect to="/escola" />;
    default:
      return <BrowserRedirect to="/login" />;
  }
}

function Router() {
  const auth = useAuth();
  const firebaseError = (auth && typeof auth === 'object' && 'firebaseError' in auth) ? auth.firebaseError : null;

  if (firebaseError) {
    return <FirebaseErrorScreen error={firebaseError} />;
  }

  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/validar" component={DocumentValidationPage} />
      <Route path="/validar/:code" component={DocumentValidationPage} />

      <Route path="/arquivo/:fileId">
        <ProtectedRoute allowedTypes={["aluno", "professor", "diretor", "responsavel", "funcionario"]}>
          <FirestoreFilePage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/aluno">
        <ProtectedRoute allowedTypes={["aluno"]}>
          <StudentDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/professor">
        <ProtectedRoute allowedTypes={["professor"]}>
          <TeacherDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/diretor">
        <ProtectedRoute allowedTypes={["diretor"]}>
          <SchoolPlatformPage />
        </ProtectedRoute>
      </Route>

      <Route path="/diretor-operacional">
        <ProtectedRoute allowedTypes={["diretor"]}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/escola">
        <ProtectedRoute allowedTypes={["aluno", "professor", "diretor", "responsavel", "funcionario"]}>
          <SchoolPlatformPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat">
        <ProtectedRoute allowedTypes={["aluno", "professor", "diretor", "responsavel", "funcionario"]}>
          <ChatPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat/:conversationId">
        <ProtectedRoute allowedTypes={["aluno", "professor", "diretor", "responsavel", "funcionario"]}>
          <ChatConversationPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/aula">
        <ProtectedRoute allowedTypes={["aluno"]}>
          <LiveClassPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/sala-professor/:sessionId">
        <ProtectedRoute allowedTypes={["professor"]}>
          <TeacherClassroomPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/sala-aluno">
        <ProtectedRoute allowedTypes={["aluno"]}>
          <StudentClassroomPage />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AccessibilityPreferencesLoader />
      <ThemeProvider>
        <SuspensionAlertProvider>
          <WarningAlertProvider>
            <AuthProvider>
              <LiveClassProvider>
                <TooltipProvider>
                  <Toaster />
                  <SuspensionAlertOverlay />
                  <WarningAlertOverlay />
                  <MfaRequiredOverlay />
                  <Router />
                </TooltipProvider>
              </LiveClassProvider>
            </AuthProvider>
          </WarningAlertProvider>
        </SuspensionAlertProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
