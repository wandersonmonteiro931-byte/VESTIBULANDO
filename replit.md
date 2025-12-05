# Vestibulando Platform

## Overview
Vestibulando is a comprehensive educational platform for vestibular and ENEM exam preparation. It facilitates task management, assignment submissions, evaluations, and student progress tracking. The system supports multiple user roles (Students, Teachers, Administrators) to streamline educational workflows and enhance the learning experience. The platform aims to modernize exam preparation, making it more efficient and accessible.

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
The platform uses a consistent violet/purple color scheme, with status indicators (amber, blue, green, red) for clarity. It supports dark mode and prioritizes responsive, mobile-first layouts with consistent spacing and the Inter font family. Shadcn UI components are used with custom theming. Role-based sidebar navigation is implemented with collapsible categories and pending action indicators, featuring distinct menus for Director, Professor, and Aluno.

### Feature Specifications

#### Authentication
CPF/Matrícula-based login with Brazilian formatting, password recovery, sequential matricula generation, role-based access control, protected routes, and restricted "aluno" self-registration.

#### Dashboards
- **Student**: View/submit assignments, track status, view grades/feedback, monitor deadlines.
- **Teacher**: Create assignments, grade submissions (0-10, text feedback), track grading.
- **Admin**: Manage users, classes (vacancies, enrollment), and platform statistics.
- **Announcements**: Admins manage targeted announcements (text/images) displayed via a real-time carousel.

#### Class Management
Comprehensive class management including vacancy tracking, configurable enrollment periods, WhatsApp group link integration, and student transfer functionality.

#### Chat System
Real-time messaging between directors, teachers, and students with full moderation features (bilateral blocking, message deletion, conversation reporting, unilateral conversation deletion). Includes automatic terms of service warnings and real-time block verification, adhering to Brazilian legal frameworks (Marco Civil da Internet, LGPD).

#### Evaluation System
Supports various evaluation types (tests, simulations, activities, assignments). Features flexible creation (attachments, in-system questions, templates), deadline management (start/end times, optional duration, late submission authorization), and targeted distribution (entire class, specific students). Includes grading with numerical scores and text feedback, configurable answer keys, PDF generation for printing, and atomic cancellation of evaluations using Firebase batch operations.

#### School Report System
Supports bimestral or trimestral grading periods for 15 configurable subjects. Features automatic calculation of subject and general averages, frequency control (presences/absences), controlled release by the administration, and student status (enrolled, approved, disapproved). Professional PDF generation for printing is included.

#### Bimester and Grade Entry System
Administrators configure four bimesters per academic year with start/end dates, grade submission deadlines, and expected average. Professors enter numerical grades (0-10) with optional observations for their assigned classes, subjects, and bimesters. Grades can be draft or submitted, and submission is locked after the deadline for professors, but not for directors. Unique IDs prevent duplicate entries.

#### Teacher Subject Control
Each teacher is assigned specific subjects, controlling which notes they can view/edit and for which subjects they can create evaluations. Administrators configure these assignments. Teachers without assigned subjects temporarily see all subjects for backward compatibility. Dropdowns are filtered by permissions, and warnings are displayed when no subjects are assigned.

#### Alphabetical Student Ordering
All student listings throughout the system are universally displayed in alphabetical order by name using `localeCompare`.

#### Disciplinary Warning Alert System
Students receive a modal alert upon login if they have unacknowledged warnings. The alert details the number of active warnings, date, reason, permanent record status, and potential for further disciplinary action. Students acknowledge warnings by clicking "I am aware," which updates a `visualizado` field.

#### Disciplinary Action Request System
Professors can request warnings/suspensions, which administrators then approve or reject. Professors use a dedicated tab to select students, action types, and provide justification. They can view the history of their requests. Administrators have a tab to review pending requests, approve (which applies the action automatically) or reject them, and add comments. Security ensures professors only manage their own requests, while administrators have full control. Firestore collection `disciplinaryRequests` tracks these actions.

#### Customizable Class Schedule System
Directors can configure custom class time slots instead of using fixed schedules. Features include:
- **Custom Time Configuration**: Add, edit, and delete time slots with start/end times and labels (e.g., "1ª Aula", "Intervalo")
- **Multiple Configurations**: Support for multiple configurations with an "active" flag to select which one is in use
- **Slot Activation**: Individual time slots can be enabled/disabled without deletion
- **Programming Calendar**: Visual calendar (using react-big-calendar) showing scheduled classes with month/week/day views
- **Integration**: ScheduleGrid and HorariosTab automatically use the active custom configuration; falls back to default HORARIOS_AULAS if none configured
- **Firestore Collections**: `configuracaoHorarios` stores time slot configurations, `eventosCalendario` stores calendar events

### Data Model
Core collections include `Usuarios` (users with roles, CPF, matricula, address), `Tarefas` (assignments), `Entregas` (submissions), `Turmas` (classes), `announcements`, `chatMessages`, `chatConversations`, `userBlocks`, `chatReports`, `avaliacoes` (evaluations), `avaliacaoQuestoes`, `avaliacaoTemplates`, `avaliacaoEntregas`, `avaliacaoAutorizacoesAtraso`, `boletins` (school reports), `boletimConfigs`, `frequencias`, `bimestresConfig`, `notasBimestre`, `disciplinaryRequests`, `configuracaoHorarios` (custom time slot configurations), and `eventosCalendario` (calendar events).

### System Design Choices
- **Real-time Synchronization**: Achieved via Firebase Firestore `onSnapshot` listeners and `useRealtimeQuery` hook, ensuring instant data reflection across dashboards. TanStack Query is configured for automatic refetching.
- **Security Hardening**: Implemented with strict Firestore security rules for user accounts, assignments, submissions, and classes, preventing privilege escalation and unauthorized access. Firebase Storage rules protect file attachments based on user roles. Null guards enhance data integrity.
- **Brazilian Localization**: Includes CPF, phone, and CEP formatting, ViaCEP API integration for address lookup, and full Portuguese UI text.

## External Dependencies
- **Firebase**: Authentication, Firestore (database), Storage (file storage).
- **ViaCEP API**: Automatic address lookup by postal code (CEP).

## Required Secrets (Environment Variables)
The system requires the following Firebase configuration variables to be set as Replit secrets:
1. `VITE_FIREBASE_API_KEY`
2. `VITE_FIREBASE_PROJECT_ID`
3. `VITE_FIREBASE_APP_ID`

These can be obtained from the Firebase Console under Project Settings > Your apps. `DATABASE_URL` is not used.

## Firestore Rules Deployment
Firestore security rules are defined in `firestore.rules`. Any changes require manual deployment via the Firebase Console: navigate to Firestore Database > Rules, copy the content from `firestore.rules`, and publish. The rules were recently updated to support new collections for evaluations, school reports, bimesters, disciplinary requests, and customizable class scheduling (`configuracaoHorarios`, `eventosCalendario`).