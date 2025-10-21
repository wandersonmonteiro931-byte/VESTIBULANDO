# ENEM+ Platform Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design principles + Academic aesthetic)

**Justification:** As a data-intensive educational platform requiring efficiency, learnability, and trust, we prioritize function over form. The design draws from Material Design's content-rich patterns and the clean professionalism of Google Classroom, Canvas, and Notion.

**Key Design Principles:**
- Clarity over decoration
- Information hierarchy through typography and spacing
- Consistent patterns for predictable navigation
- Trust-building through professional polish
- Accessibility for diverse student populations

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary: 210 100% 45% (Deep education blue - trust and focus)
- Primary Hover: 210 100% 40%
- Secondary: 140 55% 45% (Success green for completed tasks)
- Accent: 25 95% 50% (Warning orange for deadlines)
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Text Primary: 220 15% 20%
- Text Secondary: 220 10% 50%
- Border: 220 15% 90%

**Dark Mode:**
- Primary: 210 90% 55%
- Primary Hover: 210 90% 60%
- Secondary: 140 50% 50%
- Accent: 25 90% 55%
- Background: 220 20% 10%
- Surface: 220 18% 14%
- Text Primary: 0 0% 95%
- Text Secondary: 220 10% 70%
- Border: 220 15% 25%

**Status Colors (both modes adapt):**
- Pending: 40 95% 55% (Amber)
- Submitted: 210 100% 50% (Blue)
- Graded: 140 55% 45% (Green)
- Late: 0 85% 55% (Red)

### B. Typography

**Font Families:**
- Primary: Inter (all UI, body text) - via Google Fonts
- Headings: Inter (same family, varied weights for consistency)
- Monospace: JetBrains Mono (for code/IDs if needed)

**Type Scale:**
- Hero/Display: text-5xl, font-bold (48px)
- Page Title: text-3xl, font-semibold (30px)
- Section Header: text-2xl, font-semibold (24px)
- Card Title: text-lg, font-semibold (18px)
- Body: text-base, font-normal (16px)
- Caption: text-sm, font-normal (14px)
- Label: text-xs, font-medium, uppercase, tracking-wide (12px)

### C. Layout System

**Spacing Primitives:** Use Tailwind units 2, 4, 6, 8, 12, 16
- Micro spacing (within components): p-2, gap-2
- Component padding: p-4, p-6
- Section spacing: py-8, py-12
- Page margins: px-4 (mobile), px-8 (desktop)
- Large gaps: gap-8, gap-12

**Grid System:**
- Container: max-w-7xl mx-auto
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Assignment lists: Single column with max-w-4xl
- Admin tables: Full width with horizontal scroll on mobile

### D. Component Library

**Navigation:**
- Top navigation bar: Fixed header with logo left, user menu right, height h-16
- Sidebar (desktop): w-64, collapsible to icons only
- Mobile: Bottom tab bar or hamburger menu
- Active state: Bold text + accent border-l-4 on sidebar items

**Cards:**
- Assignment cards: Elevated surface (shadow-md), rounded-lg, p-6
- Include: Title, description preview, deadline badge, status indicator
- Hover: subtle lift (shadow-lg transition)

**Forms:**
- Input fields: border-2 focus:border-primary, rounded-md, p-3
- Dark mode: Maintain visible borders (not invisible inputs)
- File upload: Dashed border dropzone, drag-and-drop feedback
- Labels: Always visible, positioned above inputs

**Buttons:**
- Primary: bg-primary text-white, hover:bg-primary-hover, px-6 py-3, rounded-md
- Secondary: border-2 border-primary text-primary, hover:bg-primary/5
- Outline on images: backdrop-blur-md bg-white/20 border-2 border-white
- Icon buttons: Consistent size (h-10 w-10), clear hover states

**Data Displays:**
- Tables: Striped rows, sticky headers, responsive horizontal scroll
- Status badges: Rounded-full, px-3 py-1, colored backgrounds with dark text
- Progress indicators: Linear bars for completion tracking
- Statistics: Large numbers (text-4xl) with labels below

**Overlays:**
- Modals: Centered, max-w-2xl, backdrop-blur with dark overlay
- Dropdowns: Shadow-xl, rounded-lg, smooth slide-in animation
- Toasts: Top-right corner, auto-dismiss, status-colored borders

### E. Animations

**Minimal, Purposeful Motion:**
- Page transitions: None (instant navigation for speed)
- Card hover: transform scale-[1.02] duration-200
- Button clicks: No custom animations (native browser feedback)
- Loading states: Simple spinner or skeleton screens

---

## Page-Specific Guidelines

### Login Page
- Centered card (max-w-md) on gradient background (210 60% 98% to 210 40% 95%)
- Logo above form
- Clean input fields with visible labels
- Radio buttons or tabs for user type selection
- "Esqueceu a senha?" link below form

### Student Dashboard
- Hero section: Welcome message with student name, current week stats (3-column grid: Pending, Submitted, Graded counts)
- Assignment list: Chronological with deadline proximity sorting
- Each card shows: Subject, title, due date with countdown, status badge, "Ver Detalhes" button
- Filter chips: All, Pending, Submitted, Graded

### Teacher Dashboard
- Action-oriented header: "Criar Nova Tarefa" primary button (top-right)
- Tabs: Minhas Tarefas, Correções Pendentes, Estatísticas
- Assignment cards include student submission count
- Grading interface: Split view (student submission left, grading form right)

### Admin Panel
- Sidebar navigation: Usuários, Turmas, Estatísticas, Configurações
- User table: Sortable columns, search bar, bulk actions
- Statistics: 4-column dashboard with key metrics, bar charts for grade distribution

---

## Images

**Hero Image Usage:**
- Login page: Abstract education-themed illustration (books, graduation cap, minimalist style) as background element (opacity-20)
- Student/Teacher dashboards: No hero images (prioritize information density)
- Admin dashboard: Optional header with school/institution branding

**Icon Usage:**
- Heroicons (via CDN) for all UI icons
- Subject icons: Use emoji or simple icon representations (📚 Português, 🔢 Matemática, etc.)
- File type indicators: PDF, DOC, image previews with thumbnails

---

## Accessibility & Responsiveness

- All interactive elements minimum 44px touch target
- Color contrast ratio 4.5:1 minimum
- Dark mode toggle in user menu (persistent preference)
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Stack multi-column layouts to single column on mobile
- Tables convert to card view on mobile with expandable details