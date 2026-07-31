import type { ReactNode } from "react";
import { Redirect, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { AdminManagementPage, FinancePage, SecurityPage } from "./AdminAndFinancePages";
import { EadShell } from "./EadShell";
import { EssayWorkspacePage, ExamSimulatorPage } from "./ExamAndEssayPages";
import { StudyPlanPage } from "./HomeAndPlanPages";
import { ContentLibraryPage, QuestionBankPage } from "./LearningPages";
import { CommunityPage, LiveClassesPage } from "./LiveAndCommunityPages";
import { ScheduledLearningPage } from "./ScheduledLearningPages";
import {
  AccessibilityPage,
  PerformancePage,
  SupportPage,
} from "./PerformanceAndExperiencePages";
import {
  EssayCorrectionsPage,
  TeacherClassAnalyticsPage,
  TeacherStudioPage,
} from "./TeacherPages";

export function EadIndexRedirect() {
  const { userData } = useAuth() as any;
  const destination =
    userData?.tipo === "diretor"
      ? "/diretor"
      : userData?.tipo === "professor"
        ? "/professor"
        : "/aluno";
  return <Redirect to={destination} />;
}

export default function EadPortalPage() {
  const { section = "inicio" } = useParams<{ section: string }>();
  const { userData } = useAuth() as any;

  if (section === "inicio") {
    const destination = userData?.tipo === "diretor" ? "/diretor" : userData?.tipo === "professor" ? "/professor" : "/aluno";
    return <Redirect to={destination} />;
  }

  const pages: Record<string, ReactNode> = {
    plano: <StudyPlanPage />,
    programacao: <ScheduledLearningPage />,
    conteudos: <ContentLibraryPage />,
    questoes: <QuestionBankPage />,
    simulados: <ExamSimulatorPage />,
    redacao: <EssayWorkspacePage />,
    "ao-vivo": <LiveClassesPage />,
    comunidade: <CommunityPage />,
    desempenho: <PerformancePage />,
    estudio: <TeacherStudioPage />,
    correcoes: <EssayCorrectionsPage />,
    turmas: <TeacherClassAnalyticsPage />,
    gestao: <AdminManagementPage />,
    financeiro: <FinancePage />,
    seguranca: <SecurityPage />,
    acessibilidade: <AccessibilityPage />,
    suporte: <SupportPage />,
  };

  const fallbackSection = userData?.tipo === "diretor" ? "gestao" : userData?.tipo === "professor" ? "estudio" : "plano";
  return <EadShell section={section}>{pages[section] || pages[fallbackSection]}</EadShell>;
}
