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

#### Chat Module - Mobile-First Development
**CRITICAL: All chat features MUST work identically on both desktop and mobile devices, without exception.**

Development Guidelines:
- Every chat component and feature must be tested and optimized for mobile devices
- Animations, transitions, and UI elements must render correctly on all screen sizes
- Fixed heights should be used instead of max-heights for predictable mobile behavior
- Sufficient padding must be added to scrollable areas to prevent content cutoff
- Transform animations should be combined with height transitions for smooth mobile rendering
- All future chat modifications must maintain desktop/mobile parity

**Recent Mobile Optimizations (Oct 2024):**
- Implemented safe-area-inset support for notched devices (iOS)
- Fixed scroll behavior with touch optimization and overscroll containment
- Optimized dropdown z-index and visibility on mobile
- Compact alert messages to save vertical space
- Touch targets (44px) applied only to chat control buttons
- Prevented zoom on input focus in iOS (16px font minimum)
- Fixed layout overflow issues in ChatWindow and ChatMessageArea
- **Lightweight Mobile Interface (Oct 24, 2024):**
  - Removed large warning alert from chat area for cleaner interface
  - Reduced padding and spacing throughout (p-2 → p-1.5 on mobile)
  - Optimized message bubble width (85% on mobile, 80% on tablets)
  - Compact header and input areas with smaller avatars (36px on mobile)
  - Reduced font sizes while maintaining accessibility (text-xs/12px minimum for readable text, 11px for timestamps)
  - Streamlined alert messages to single-word status indicators on mobile
  - Maintained 44px touch targets for all interactive elements

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

#### Data Model
The core data model includes `Usuarios` (users with `aluno`, `professor`, `admin` types, CPF, matricula, address via ViaCEP), `Tarefas` (assignments with title, description, professor, class, deadline, attachments), `Entregas` (submissions with student info, file, grade, feedback, status), and `Turmas` (classes with name, year, activity status, vacancies, enrollment period, WhatsApp link). Additional collection for `announcements` stores system notices.

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