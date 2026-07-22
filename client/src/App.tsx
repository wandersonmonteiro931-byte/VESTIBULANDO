import { Switch, Route, Redirect } from "wouter";
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
import Login from "@/pages/Login";
import StudentDashboard from "@/pages/StudentDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import ChatPage from "@/pages/ChatPage";
import ChatConversationPage from "@/pages/ChatConversationPage";
import LiveClassPage from "@/pages/LiveClassPage";
import TeacherClassroomPage from "@/pages/TeacherClassroomPage";
import StudentClassroomPage from "@/pages/StudentClassroomPage";
import NotFound from "@/pages/not-found";
import type { User } from "@shared/schema";

function RootRedirect() {
  const auth = useAuth();
  const userData: User | null = (auth && typeof auth === 'object' && 'userData' in auth) ? (auth.userData as User | null) : null;
  const loading = (auth && typeof auth === 'object' && 'loading' in auth) ? auth.loading : true;

  if (loading) {
    return null;
  }

  if (!userData) {
    return <Redirect to="/login" />;
  }

  switch (userData.tipo) {
    case "aluno":
      return <Redirect to="/aluno" />;
    case "professor":
      return <Redirect to="/professor" />;
    case "diretor":
      return <Redirect to="/diretor" />;
    default:
      return <Redirect to="/login" />;
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
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat">
        <ProtectedRoute allowedTypes={["aluno", "professor", "diretor"]}>
          <ChatPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/chat/:conversationId">
        <ProtectedRoute allowedTypes={["aluno", "professor", "diretor"]}>
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
      <ThemeProvider>
        <SuspensionAlertProvider>
          <WarningAlertProvider>
            <AuthProvider>
              <LiveClassProvider>
                <TooltipProvider>
                  <Toaster />
                  <SuspensionAlertOverlay />
                  <WarningAlertOverlay />
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
