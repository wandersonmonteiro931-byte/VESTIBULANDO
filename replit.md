# ENEM+ Platform

## Overview
ENEM+ is a comprehensive educational platform designed for ENEM exam preparation. It supports task management, assignment submissions, evaluations, and student progress tracking. The system is multi-user, offering distinct access levels for Students, Teachers, and Administrators, aiming to streamline educational workflows and enhance the learning experience.

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
- **Componentes**:
  - `AvaliacoesTab.tsx` - Interface do professor/diretor
  - `AlunoAvaliacoesTab.tsx` - Interface do aluno

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

**IMPORTANTE**: As regras do Firestore foram atualizadas em 26/10/2025 para incluir suporte às novas coleções `userBlocks` e `chatReports` do sistema de chat. É necessário implantar essas regras para que o chat funcione corretamente.