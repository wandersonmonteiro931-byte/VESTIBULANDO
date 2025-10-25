import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FirebaseErrorScreen } from "@/components/FirebaseErrorScreen";
import Login from "@/pages/Login";
import StudentDashboard from "@/pages/StudentDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import ChatPage from "@/pages/ChatPage";
import ChatConversationPage from "@/pages/ChatConversationPage";
import NotFound from "@/pages/not-found";

function RootRedirect() {
  const { userData, loading } = useAuth();

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
  const { firebaseError } = useAuth();

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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
