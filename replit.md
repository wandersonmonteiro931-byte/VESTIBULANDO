# ENEM+ Platform

## Overview
Plataforma educacional completa para preparação do ENEM com gestão de tarefas, envio de trabalhos, avaliações e acompanhamento de estudantes. Sistema multi-usuário com três tipos de acesso: Aluno, Professor e Administrador.

## Current State
- **Phase**: MVP Development - Task 1 Complete (Schema & Frontend)
- **Status**: Frontend components built with Firebase integration setup
- **Last Updated**: January 2025

## Recent Changes
- Created complete data model for usuarios, tarefas, entregas, and turmas
- Implemented Firebase authentication with Google and email/password
- Built all main dashboards (Student, Teacher, Admin) with full UI
- Added theme toggle (dark/light mode)
- Implemented file upload system for assignments and submissions
- Created reusable components (StatusBadge, FileUploadZone, ThemeToggle, ProtectedRoute)
- Hardened Firestore security rules with proper authentication and null guards
- Added comprehensive file upload validation (size, type, role-based)
- Implemented error handling with toast notifications for file uploads
- Created deployment documentation (FIREBASE_SETUP.md)
- Added Storage security rules with 10MB file size limits

## Project Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + Shadcn UI Components
- **Backend**: Firebase (Auth, Firestore, Storage)
- **State Management**: TanStack Query + React Context
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod validation

### User Types & Permissions

#### Aluno (Student)
- View assignments by turma (class)
- Submit assignment files (PDF, DOC, images)
- Track submission status (pendente, entregue, atrasado, avaliado)
- View grades and feedback from teachers
- Download assignment materials

#### Professor (Teacher)
- Create assignments with descriptions, deadlines, and attachments
- View all student submissions
- Grade submissions with numerical scores (0-10) and text feedback
- Track grading progress per assignment
- Manage assignments by turma

#### Admin (Administrator)
- Create and manage user accounts (students, teachers, admins)
- Create and manage turmas (classes)
- View platform statistics
- Activate/deactivate user accounts
- View system-wide activity metrics

### Data Model

#### Usuarios (Users)
```typescript
{
  uid: string
  nome: string
  email: string
  tipo: "aluno" | "professor" | "admin"
  turma?: string (for students)
  ativo: boolean
}
```

#### Tarefas (Assignments)
```typescript
{
  id: string
  titulo: string
  descricao: string
  professorId: string
  professorNome: string
  turma: string
  prazo: string (ISO datetime)
  arquivoAnexo?: string (Firebase Storage URL)
  arquivoNome?: string
  criadoEm: string (ISO datetime)
}
```

#### Entregas (Submissions)
```typescript
{
  id: string
  tarefaId: string
  tarefaTitulo: string
  alunoId: string
  alunoNome: string
  alunoEmail: string
  dataEnvio: string (ISO datetime)
  arquivo: string (Firebase Storage URL)
  arquivoNome: string
  nota?: number (0-10)
  feedback?: string
  status: "pendente" | "entregue" | "avaliado" | "atrasado"
}
```

#### Turmas (Classes)
```typescript
{
  id: string
  nome: string (e.g., "3A", "2B")
  ano: string
  ativa: boolean
}
```

### Firebase Collections
- `usuarios` - User accounts
- `tarefas` - Assignments created by teachers
- `entregas` - Student submissions
- `turmas` - Class/grade groups

### Firebase Storage Structure
```
/tarefas/{professorId}/{timestamp}_{filename} - Assignment attachments
/entregas/{alunoId}/{tarefaId}/{filename} - Student submissions
```

### Key Features Implemented

#### Authentication
- Email/password authentication
- Google Sign-In
- Auto-redirect based on user type
- Protected routes with role-based access control
- Session persistence

#### Student Dashboard
- Assignment cards with status badges
- File upload for submissions
- Grade and feedback display
- Deadline tracking with countdown
- Tabbed interface (All, Pending, Submitted, Grades)
- Statistics cards (Pending, Submitted, Graded)

#### Teacher Dashboard
- Assignment creation form with file attachments
- Student submission list with status
- Grading interface with numerical scores and feedback
- Progress tracking per assignment
- Statistics (Total Tasks, Pending Corrections, Graded)

#### Admin Dashboard
- User management table with status toggle
- User creation form with role selection
- Turma management with student counts
- Platform statistics overview
- Responsive data tables

#### Design System
- Primary color: Deep blue (210 100% 45%) - Education trust theme
- Status colors: Amber (pending), Blue (submitted), Green (graded), Red (late)
- Dark mode support with persistent preference
- Responsive layouts (mobile-first)
- Consistent spacing (4, 6, 8, 12, 16px)
- Inter font family throughout
- Shadcn UI components with custom theming

### Component Structure
```
client/src/
├── components/
│   ├── ui/ (Shadcn components)
│   ├── ThemeToggle.tsx
│   ├── StatusBadge.tsx
│   ├── FileUploadZone.tsx
│   └── ProtectedRoute.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── lib/
│   ├── firebase.ts
│   └── queryClient.ts
├── pages/
│   ├── Login.tsx
│   ├── StudentDashboard.tsx
│   ├── TeacherDashboard.tsx
│   └── AdminDashboard.tsx
└── App.tsx
```

## Environment Variables
Required secrets (configured in Replit Secrets):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `SESSION_SECRET`

## Next Steps
1. Backend implementation (Firebase rules, indexes)
2. Integration testing and bug fixes
3. Error handling improvements
4. Loading states refinement
5. File upload validation
6. Email notifications for assignments
7. Performance optimization

## Development Guidelines
- Follow design_guidelines.md for all UI implementations
- Use TanStack Query for all data fetching
- Validate all forms with Zod schemas
- Add data-testid attributes to interactive elements
- Maintain responsive design across all breakpoints
- Keep components modular and reusable
