# Vestibulando Platform

## Overview
Vestibulando is a comprehensive educational platform designed for vestibular and ENEM exam preparation. It supports task management, assignment submissions, evaluations, and student progress tracking. The system is multi-user, offering distinct access levels for Students, Teachers, and Administrators, aiming to streamline educational workflows and enhance the learning experience.

## User Preferences
I prefer simple language and clear explanations. I want iterative development with frequent, small updates. Please ask for my approval before making any major architectural changes or significant modifications to existing features. I expect the agent to prioritize robust, secure, and maintainable code. Do not make changes to the `lib/firebase.ts` file without explicit instruction.

## System Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + Shadcn UI Components
- **Backend**: Firebase (Auth, Firestore, Storage)
- **State Management**: TanStack Query + React Context
- **Real-time Sync**: Firebase onSnapshot listeners with custom `useRealtimeQuery` hook
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod validation

### UI/UX Decisions
The platform utilizes a consistent violet/purple color scheme across all dashboards (Login, Student, Teacher, Admin) to convey an educational trust theme. Status indicators use amber (pending), blue (submitted), green (graded), and red (late) for clarity. Dark mode is supported with persistent preference. Responsive layouts are prioritized (mobile-first), maintaining consistent spacing and using the Inter font family throughout. Shadcn UI components are used with custom theming.

### Feature Specifications

#### Authentication
- CPF/Matrícula-based login system with Brazilian formatting.
- Password recovery via CPF verification.
- Sequential matricula generation (e.g., "0100") using atomic Firestore transactions.
- Role-based access control and protected routes.
- Self-registration is restricted to "aluno" accounts only for security.

#### Dashboards
- **Student Dashboard**: View assignments, submit files, track submission status, view grades and feedback, and monitor deadlines.
- **Teacher Dashboard**: Create assignments with attachments, view and grade student submissions with numerical scores (0-10) and text feedback, and track grading progress.
- **Admin Dashboard**: Manage user accounts (create, activate/deactivate), manage classes (turmas) including vacancy tracking and enrollment periods, and view platform statistics.
- **Announcements System**: Admins can manage announcements with text/images, target specific audiences (all students, all teachers, specific classes), and announcements are displayed via a real-time carousel on dashboards.

#### Class Management
- Comprehensive class management including total and filled vacancy tracking, configurable enrollment periods, and WhatsApp group link integration.
- Student transfer functionality between classes.

#### Chat System (NOVO - Outubro 2025)
- **Sistema de Mensagens**: Chat em tempo real entre diretoria, professores e alunos.
- **Moderação Completa**: 
  - Bloqueio bilateral de usuários (afeta ambas as partes)
  - Exclusão de mensagens (para mim / para todos)
  - Denúncia de conversas com justificativa
  - Exclusão unilateral de conversas
  - Aviso de termos automático antes de cada conversa
- **Conformidade Legal**: Sistema alinhado com Marco Civil da Internet e LGPD.
- **Segurança**: Verificação em tempo real de bloqueios antes de enviar mensagens.

#### Sistema de Avaliações (NOVO - Dezembro 2025)
- **Tipos de Avaliação**: Provas, Simulados, Atividades e Trabalhos
- **Criação Flexível**: 
  - Anexar arquivos externos (PDF, Word, etc.)
  - Criar questões diretamente no sistema (objetivas, dissertativas)
  - Usar templates pré-definidos
- **Gerenciamento de Prazos**:
  - Data/hora de início (quando fica disponível)
  - Data/hora limite (prazo final)
  - Duração opcional (tempo máximo para realizar)
  - Autorização para entregas atrasadas
- **Destinatários**:
  - Turma inteira
  - Alunos específicos
- **Correção e Notas**:
  - Correção por turma
  - Notas numéricas com feedback textual
  - Visualização de gabarito (configurável)
- **PDF/Impressão**: Geração de PDF para impressão com cabeçalho padrão
- **Cancelamento de Avaliações**: Exclusão atômica de avaliação e todas as entregas relacionadas usando Firebase batch operations
- **Componentes**:
  - `AvaliacoesTab.tsx` - Interface do professor/diretor
  - `AlunoAvaliacoesTab.tsx` - Interface do aluno

#### Sistema de Boletim Escolar (NOVO - Dezembro 2025)
- **Notas por Período**: Suporte para sistema bimestral (4 períodos) ou trimestral (3 períodos)
- **Matérias Padrão**: 15 matérias configuráveis (Português, Matemática, História, etc.)
- **Cálculo Automático**: Médias por matéria e média geral calculadas automaticamente
- **Controle de Frequência**: Registro de presenças e faltas com percentual de frequência
- **Liberação Controlada**: Diretoria deve liberar boletins antes que alunos possam visualizar
- **Situação do Aluno**: Cursando, Aprovado ou Reprovado
- **Impressão PDF**: Geração de PDF profissional com layout para assinaturas
- **Componentes**:
  - `BoletimTab.tsx` - Interface da diretoria para criar/editar/liberar boletins
  - `AlunoBoletimTab.tsx` - Interface do aluno para visualizar boletins liberados

#### Sistema de Bimestres e Lançamento de Notas (NOVO - Dezembro 2025)
- **Configuração de Bimestres**:
  - Diretoria define 4 bimestres por ano letivo
  - Data de início e fim de cada bimestre
  - Prazo para lançamento de notas pelos professores
  - Média esperada configurável por bimestre
  - Status ativo/inativo para controle
- **Lançamento de Notas**:
  - Professores lançam notas por turma, matéria e bimestre
  - Notas numéricas de 0 a 10 com validação
  - Campo de observação opcional por aluno
  - Status de rascunho ou entregue
  - Bloqueio automático após prazo expirado (exceto para diretoria)
  - IDs únicos por (aluno, bimestre, turma, matéria) para evitar duplicatas
- **Componentes**:
  - `BimestresTab.tsx` - Interface da diretoria para configurar bimestres
  - `BimestresNotasTab.tsx` - Interface dos professores para lançar notas

#### Controle de Matérias por Professor (NOVO - Dezembro 2025)
- **Atribuição de Matérias**:
  - Cada professor possui um campo `materias` (array) com as matérias que leciona
  - Diretoria configura as matérias do professor no cadastro/edição
  - Suporte para múltiplas matérias por professor
- **Controle de Permissões**:
  - Professores só visualizam e editam notas das suas matérias atribuídas
  - Professores só criam avaliações para suas matérias atribuídas
  - Diretoria tem acesso total a todas as matérias
  - Retrocompatibilidade: professores sem matérias cadastradas veem todas (temporário)
- **Interface**:
  - Dropdowns de matérias filtrados automaticamente por permissão
  - Mensagem de aviso quando professor não tem matérias cadastradas
  - Componentes afetados: BimestresNotasTab, AvaliacoesTab

#### Ordenação Alfabética de Alunos (NOVO - Dezembro 2025)
- **Regra Universal**: Todas as listagens de alunos no sistema exibem nomes em ordem alfabética
- **Implementação**: Uso de `.sort((a, b) => a.nome.localeCompare(b.nome))` em todas as listas
- **Componentes afetados**: AdminDashboard, BimestresNotasTab, BoletimTab, MonitoringTab

#### Sistema de Alerta de Advertência (NOVO - Dezembro 2025)
- **Modal de Notificação**: Quando uma advertência é aplicada ao aluno, ele vê um modal ao fazer login
- **Mensagem de Aviso**: O modal informa:
  - Quantidade de advertências ativas (X de 3)
  - Data e motivo da advertência
  - Que será registrada permanentemente no histórico escolar
  - Que práticas continuadas podem resultar em novas correções disciplinares (incluindo suspensão)
- **Controle de Visualização**: 
  - Campo `visualizado` no documento da advertência para evitar exibição repetida
  - Aluno marca como visualizado ao clicar em "Estou ciente"
- **Componentes**:
  - `WarningAlertContext.tsx` - Contexto global para gerenciar alertas
  - `WarningAlertOverlay.tsx` - Modal de exibição da advertência
  - Integrado no StudentDashboard para verificar advertências não visualizadas

#### Data Model
The core data model includes `Usuarios` (users with `aluno`, `professor`, `admin` types, CPF, matricula, address via ViaCEP), `Tarefas` (assignments with title, description, professor, class, deadline, attachments), `Entregas` (submissions with student info, file, grade, feedback, status), and `Turmas` (classes with name, year, activity status, vacancies, enrollment period, WhatsApp link). Additional collections: `announcements` (system notices), `chatMessages` (chat messages), `chatConversations` (conversations), `userBlocks` (user blocks), `chatReports` (conversation reports).

### System Design Choices
- **Real-time Synchronization**: Implemented using Firebase Firestore's `onSnapshot` listeners and a custom `useRealtimeQuery` hook to ensure all dashboards reflect data changes instantly. TanStack Query is configured for automatic refetch on window focus and reconnect.
- **Security Hardening**: Strict Firestore security rules are applied for user accounts (preventing privilege escalation), assignments (professors manage their own), submissions (students submit their own, professors grade theirs), and classes (read-only for most, admin write access). Storage rules protect assignment attachments and student submissions based on user roles. Null guards are used in helper functions for data integrity.
- **Brazilian Localization**: Implemented CPF, phone, and CEP formatting. Integrated ViaCEP API for automatic address lookup. All UI text is in Portuguese.

## External Dependencies
- **Firebase**: Authentication, Firestore (database), Storage (file storage).
- **ViaCEP API**: Used for automatic address lookup by postal code (CEP) during user registration.

## Required Secrets (Environment Variables)

### Obrigatórios para Funcionamento
O sistema requer os seguintes secrets configurados no Replit para funcionar:

1. **VITE_FIREBASE_API_KEY** - Chave de API do Firebase
2. **VITE_FIREBASE_PROJECT_ID** - ID do projeto Firebase  
3. **VITE_FIREBASE_APP_ID** - ID da aplicação Firebase

### Como Obter os Secrets
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Vá em Project Settings > Your apps
3. Copie os valores correspondentes do SDK configuration
4. Adicione como Secrets no Replit (Tools > Secrets)

### Secrets NÃO Necessários
- **DATABASE_URL**: Este projeto usa Firebase Firestore. DATABASE_URL não é utilizado e pode ser ignorado.

Para instruções completas de configuração, consulte `FIREBASE_SETUP.md` e `README.md`.

## Implantação de Regras do Firestore

As regras de segurança do Firestore estão no arquivo `firestore.rules`. Após alterações, você deve implantá-las manualmente:

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `plataforma-enem-f3682`
3. Vá em **Firestore Database** > **Regras**
4. Copie o conteúdo do arquivo `firestore.rules` local
5. Cole no editor do Firebase Console
6. Clique em **Publicar**

**IMPORTANTE**: As regras do Firestore foram atualizadas em 04/12/2025 para incluir suporte às novas coleções do sistema de avaliações, boletins e bimestres:
- `avaliacoes` - provas, simulados, atividades, trabalhos
- `avaliacaoQuestoes` - questões das avaliações
- `avaliacaoTemplates` - modelos de prova
- `avaliacaoEntregas` - entregas dos alunos
- `avaliacaoAutorizacoesAtraso` - autorizações para entregas atrasadas
- `boletins` - boletins escolares dos alunos
- `boletimConfigs` - configurações de liberação de boletins
- `frequencias` - registros de frequência/presença
- `bimestresConfig` - configuração dos bimestres por ano letivo
- `notasBimestre` - notas lançadas por bimestre/turma/matéria

É necessário implantar essas regras no Firebase Console para que o sistema de avaliações e bimestres funcione corretamente.