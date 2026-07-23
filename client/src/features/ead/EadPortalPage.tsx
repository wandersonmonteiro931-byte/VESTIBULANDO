import type { ReactNode } from "react";
import { Redirect, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { AdminManagementPage, FinancePage, SecurityPage } from "./AdminAndFinancePages";
import { EadShell } from "./EadShell";
import { EssayWorkspacePage, ExamSimulatorPage } from "./ExamAndEssayPages";
import { StudentHomePage, StudyPlanPage } from "./HomeAndPlanPages";
import { ContentLibraryPage, QuestionBankPage } from "./LearningPages";
import { CommunityPage, LiveClassesPage } from "./LiveAndCommunityPages";
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
      ? "/ead/gestao"
      : userData?.tipo === "professor"
        ? "/ead/estudio"
        : "/ead/inicio";
  return <Redirect to={destination} />;
}

export default function EadPortalPage() {
  const { section = "inicio" } = useParams<{ section: string }>();

  const pages: Record<string, ReactNode> = {
    inicio: <StudentHomePage />,
    plano: <StudyPlanPage />,
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

  return <EadShell section={section}>{pages[section] || pages.inicio}</EadShell>;
}
