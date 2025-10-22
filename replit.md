# ENEM+ Platform

## Overview
Plataforma educacional completa para preparação do ENEM com gestão de tarefas, envio de trabalhos, avaliações e acompanhamento de estudantes. Sistema multi-usuário com três tipos de acesso: Aluno, Professor e Administrador.

## Current State
- **Phase**: MVP Complete - Ready for Deployment
- **Status**: All features implemented with security hardening complete
- **Last Updated**: October 2025

## Recent Changes (October 2025)

**Vacancy Count Fix (Latest - October 22, 2025):**
- ✅ Fixed critical bug where vacancy counts (vagasPreenchidas) were not updating correctly
- ✅ Corrected all student filters and selections to use turma ID instead of turma name
- ✅ Fixed all SelectItem components to use turma IDs for proper referencing
- ✅ Updated bulkTransferStudentsMutation to use IDs throughout the transaction
- ✅ Updated bulkRemoveStudentsMutation to use IDs directly without name lookups
- ✅ Added automatic query invalidation for /api/turmas in all student-affecting mutations
- ✅ Ensured all mutations (add, transfer, remove students) properly update vagasPreenchidas atomically
- ✅ Vacancy counts now update automatically and correctly for all operations

**Enrollment Management System:**
- ✅ Added "Edit" button for directors to edit pending solicitations directly
- ✅ Created comprehensive edit solicitation dialog with all student data fields
- ✅ Implemented "Stand By" (waitlist) status with dedicated mutation and dialog
- ✅ Updated Login.tsx to block editing of rejected (reprovado) solicitations
- ✅ Enhanced status verification to display rejection and standby comments
- ✅ Added visual distinction between editable "devolvido" and non-editable "reprovado" states
- ✅ Implemented updateSolicitacaoMutation with cache invalidation and toasts
- ✅ Added standbyUserMutation for moving applicants to waitlist queue
- ✅ Enhanced status verification dialog with standby status display

**Admin Panel Enhancements & Class Management:**
- ✅ Implemented violet/purple color scheme across all dashboards (Login, Student, Teacher, Admin)
- ✅ Admin can create teacher/admin accounts directly with password setting
- ✅ Teachers can be assigned to multiple classes
- ✅ Added comprehensive class management features:
  - Total and filled vacancy tracking (vagasTotais, vagasPreenchidas)
  - Enrollment period configuration (periodoMatriculaInicio, periodoMatriculaFim)
  - WhatsApp group link integration with edit dialog
  - Open/close toggle functionality for classes
- ✅ Student transfer feature between classes with dialog interface
- ✅ Updated Turma schema in shared/schema.ts with new fields
- ✅ Enhanced user table with transfer and delete action buttons
- ✅ Updated all UI text on Login page with enrollment requirements

**Brazilian Localization & Authentication:**
- ✅ Changed authentication from email to CPF/Matrícula login system
- ✅ Implemented sequential matricula generation starting from 0100 using atomic Firestore transactions
- ✅ Added Brazilian formatting: CPF (xxx.xxx.xxx-xx), Phone ((XX)XXXXX-XXXX), CEP (XXXXX-XXX)
- ✅ Integrated ViaCEP API for automatic address lookup by postal code
- ✅ Implemented CPF-based password recovery flow
- ✅ Updated all UI text to Portuguese (student registration, security notices)
- ✅ Created Firestore security rules for matriculaCounter with monotonic increment validation
- ✅ Documented admin setup process (CPF: 709.731.041-39, Matrícula: 9318) in CRIAR_ADMIN.md
- ⚠️ Matricula counter accessible to unauthenticated users - suitable for dev/test, requires Cloud Functions for production

**Real-time Synchronization:**
- ✅ Implemented Firebase Firestore real-time listeners using onSnapshot
- ✅ Created useRealtimeQuery hook for automatic data synchronization
- ✅ Updated all dashboards (Student, Teacher, Admin) to use real-time data
- ✅ Configured TanStack Query for automatic refetch on window focus and reconnect
- ✅ Data now updates automatically across all clients when changes occur in Firebase

**Security Hardening:**
- ✅ Restricted self-registration to "aluno" accounts only (prevents privilege escalation)
- ✅ Added null guards to all Firestore and Storage helper functions
- ✅ Implemented professor-to-assignment access control in Firestore and Storage
- ✅ Fixed cross-class data exposure in entregas submissions
- ✅ Validated all security rules with architect review
- ✅ Enhanced file upload validation with proper error handling

**Core Implementation:**
- Created complete data model for usuarios, tarefas, entregas, and turmas
- Built all main dashboards (Student, Teacher, Admin) with full UI
- Added theme toggle (dark/light mode)
- Implemented file upload system for assignments and submissions
- Created reusable components (StatusBadge, FileUploadZone, ThemeToggle, ProtectedRoute)

## Project Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + Shadcn UI Components
- **Backend**: Firebase (Auth, Firestore, Storage)
- **State Management**: TanStack Query + React Context
- **Real-time Sync**: Firebase onSnapshot listeners with custom useRealtimeQuery hook
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
  cpf: string (formatted: xxx.xxx.xxx-xx)
  matricula: string (sequential 4-digit, e.g., "0100", "9318")
  tipo: "aluno" | "professor" | "admin"
  turma?: string (for students)
  telefone?: string (formatted: (XX)XXXXX-XXXX)
  cep?: string (formatted: XXXXX-XXX)
  endereco?: string (auto-filled via ViaCEP)
  ativo: boolean
  status: "pendente" | "aprovado" | "reprovado"
  dataCriacao: timestamp
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
  vagasTotais?: number (total vacancies)
  vagasPreenchidas?: number (filled vacancies)
  periodoMatriculaInicio?: string (enrollment start date)
  periodoMatriculaFim?: string (enrollment end date)
  linkWhatsApp?: string (WhatsApp group link)
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
- CPF/Matrícula-based login system (Brazilian format)
- Password recovery using CPF verification
- Sequential matricula generation (starting from 0100)
- Auto-redirect based on user type
- Protected routes with role-based access control
- Session persistence
- Integrated ViaCEP for address auto-fill

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
- **First Admin Bootstrap**: Register as aluno, then manually upgrade in Firebase Console (see CRIAR_ADMIN.md)

### Firestore Security Rules
- **usuarios**: Self-signup as aluno only; admins can create any type; no privilege escalation
- **tarefas**: Professors can only manage their own assignments
- **entregas**: Students can submit; professors can grade only their own assignment submissions
- **turmas**: Read-only for all; admins can create/update
- **system/matriculaCounter**: Read-only for all; write restricted to monotonic +1 increments or admin override
- **Null Guards**: All helper functions check document existence before data access

### Matricula Counter Security
The sequential matricula generation uses Firestore transactions with the following rules:
- **Read**: Anyone can read the counter (required for atomic transactions)
- **Write**: Only allowed if:
  - Document doesn't exist (initialization)
  - New value is exactly previous + 1 (monotonic increment)
  - User is admin (maintenance override)
- **⚠️ Production Note**: Current implementation allows unauthenticated increments during registration. For production deployment, implement Cloud Functions for full security. See CRIAR_ADMIN.md for details.

### Storage Security Rules
- **tarefas/**: Professors upload their own attachments; all authenticated users can read (educational materials)
- **entregas/**: Students upload to their own folders; professors can access only submissions for their assignments
- **File Limits**: 10MB maximum per file; validated client and server-side
- **Null Guards**: All helper functions check user document existence

## Deployment Checklist
1. ✅ Configure Firebase project (see CRIAR_ADMIN.md)
2. ✅ Add environment secrets in Replit (VITE_FIREBASE_*)
3. ✅ Deploy Firestore security rules (`firebase deploy --only firestore:rules`)
4. ✅ Deploy Storage security rules (`firebase deploy --only storage`)
5. ✅ Initialize matricula counter in Firestore (`system/matriculaCounter` with `ultimaMatricula: 9317`)
6. ✅ Create first admin user (see CRIAR_ADMIN.md for manual setup)
7. ✅ Enable Authentication providers (Email/Password only - Google removed)
8. ✅ Test all user flows (student, teacher, admin)
9. ✅ Verify file uploads work correctly
10. ✅ Test CPF/Matricula login and password recovery
11. ✅ Verify sequential matricula generation (starts at 0100, admin at 9318)

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
