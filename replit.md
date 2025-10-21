# ENEM+ Platform

## Overview
Plataforma educacional completa para preparação do ENEM com gestão de tarefas, envio de trabalhos, avaliações e acompanhamento de estudantes. Sistema multi-usuário com três tipos de acesso: Aluno, Professor e Administrador.

## Current State
- **Phase**: MVP Complete - Ready for Deployment
- **Status**: All features implemented with security hardening complete
- **Last Updated**: October 2025

## Recent Changes (October 2025)
**Security Hardening Complete:**
- ✅ Restricted self-registration to "aluno" accounts only (prevents privilege escalation)
- ✅ Added null guards to all Firestore and Storage helper functions
- ✅ Implemented professor-to-assignment access control in Firestore and Storage
- ✅ Fixed cross-class data exposure in entregas submissions
- ✅ Validated all security rules with architect review
- ✅ Updated FIREBASE_SETUP.md with bootstrap admin instructions
- ✅ Removed user type selector from registration form
- ✅ Enhanced file upload validation with proper error handling

**Previous Implementation:**
- Created complete data model for usuarios, tarefas, entregas, and turmas
- Implemented Firebase authentication with Google and email/password
- Built all main dashboards (Student, Teacher, Admin) with full UI
- Added theme toggle (dark/light mode)
- Implemented file upload system for assignments and submissions
- Created reusable components (StatusBadge, FileUploadZone, ThemeToggle, ProtectedRoute)
- Created deployment documentation (FIREBASE_SETUP.md)

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

## Security Model

### User Account Creation
**Important:** For security reasons, self-registration creates "aluno" (student) accounts only.

- **Self-Registration**: Creates aluno accounts automatically
- **Professor/Admin Accounts**: Must be created by existing administrators
- **First Admin Bootstrap**: Register as aluno, then manually upgrade in Firebase Console (see FIREBASE_SETUP.md)

### Firestore Security Rules
- **usuarios**: Self-signup as aluno only; admins can create any type; no privilege escalation
- **tarefas**: Professors can only manage their own assignments
- **entregas**: Students can submit; professors can grade only their own assignment submissions
- **turmas**: Read-only for all; admins can create/update
- **Null Guards**: All helper functions check document existence before data access

### Storage Security Rules
- **tarefas/**: Professors upload their own attachments; all authenticated users can read (educational materials)
- **entregas/**: Students upload to their own folders; professors can access only submissions for their assignments
- **File Limits**: 10MB maximum per file; validated client and server-side
- **Null Guards**: All helper functions check user document existence

## Deployment Checklist
1. ✅ Configure Firebase project (see FIREBASE_SETUP.md)
2. ✅ Add environment secrets in Replit (VITE_FIREBASE_*)
3. ✅ Deploy Firestore security rules
4. ✅ Deploy Storage security rules
5. ✅ Enable Authentication providers (Email/Password, Google)
6. ✅ Create first admin user (bootstrap process)
7. ✅ Test all user flows (student, teacher, admin)
8. ✅ Verify file uploads work correctly
9. ✅ Test dark mode and responsive layouts

## Future Enhancements
1. Email notifications for new assignments and grades
2. Assignment templates for teachers
3. Bulk grading interface
4. Student progress analytics
5. Assignment categories and tags
6. File preview in-app (PDF viewer)
7. Mobile app version
8. Export grades to CSV/Excel

## Development Guidelines
- Follow design_guidelines.md for all UI implementations
- Use TanStack Query for all data fetching
- Validate all forms with Zod schemas
- Add data-testid attributes to interactive elements
- Maintain responsive design across all breakpoints
- Keep components modular and reusable
