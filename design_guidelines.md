# Design Guidelines: Security Guard Attendance Web Application

## Design Approach: Material Design System (Productivity Variant)

**Rationale**: This is a data-heavy, utility-focused application requiring clarity, efficiency, and professional trustworthiness. Material Design provides excellent patterns for data tables, forms, and mobile interfaces while maintaining clean hierarchy.

**Key Principles**:
- Function over decoration - every element serves a purpose
- Clear information hierarchy for quick scanning
- Mobile-optimized for guards, desktop-optimized for admins
- Professional appearance to convey reliability and authority

---

## Core Design Elements

### A. Typography

**Font Stack**: 
- Primary: Noto Sans KR (Google Fonts) - excellent Korean character support with professional appearance
- Fallback: -apple-system, sans-serif

**Hierarchy**:
- H1 (Page titles): text-3xl font-bold (Admin Dashboard, 출근 관리)
- H2 (Section headers): text-2xl font-semibold (현장별 출근 현황, QR 코드 관리)
- H3 (Card/Table headers): text-lg font-semibold
- Body text: text-base font-normal
- Table data: text-sm font-normal
- Labels/Meta: text-sm font-medium
- Buttons: text-sm font-semibold (uppercase for primary CTAs)

### B. Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 8, 12, 16** consistently
- Tight spacing: p-2, gap-2 (table cells, compact lists)
- Standard spacing: p-4, gap-4 (cards, form groups)
- Section spacing: p-8, gap-8 (major content blocks)
- Large spacing: p-12, gap-12 (page sections on desktop)
- Extra-large: p-16 (container padding on desktop)

**Grid System**:
- Admin Dashboard: max-w-7xl mx-auto px-4 md:px-8
- Mobile Guard View: max-w-md mx-auto px-4
- Attendance Table: Full-width with horizontal scroll on mobile

---

## Component Library

### 1. Navigation

**Admin Header**:
- Sticky top navigation with company logo (미래에이비엠 or 다원피엠씨)
- Right-aligned: User profile dropdown, 로그아웃
- Height: h-16
- Background: Elevated surface with subtle shadow

**Guard Mobile Navigation**:
- Bottom tab bar (h-16) with large touch targets
- Icons: 홈, 출근하기, 내역, 프로필
- Active state clearly indicated

### 2. Data Display

**Attendance Grid Table**:
- Header row: Sticky, elevated background, font-semibold
- First column (Names): Sticky left, w-32 md:w-48
- Date columns: w-10 text-center (1-31)
- Cell states:
  - Present: 'O' centered, font-semibold
  - Absent: Empty or '-' with reduced opacity
- Borders: Border-collapse with subtle dividers
- Row hover state for desktop
- Compact on mobile (text-xs), comfortable on desktop (text-sm)
- Company section headers with distinct background treatment

**Stats Cards**:
- Grid: grid-cols-1 md:grid-cols-3 gap-4
- Each card: Rounded corners (rounded-lg), p-6
- Icon + Number (text-3xl font-bold) + Label structure
- Examples: 총 근무자, 오늘 출근, 이번 달 출근율

### 3. Forms & Inputs

**QR Code Generation Form**:
- Label above input (text-sm font-medium mb-2)
- Input fields: h-12, rounded-lg, px-4
- Focus states with clear outline
- Helper text below inputs (text-xs)

**Date Picker**:
- Month/Year selector for viewing historical data
- Large touch targets on mobile
- Quick navigation: 이전 달, 다음 달, 오늘

### 4. Buttons & Actions

**Primary CTA** (출근하기, QR 생성):
- h-12 md:h-14, px-8, rounded-lg
- font-semibold, uppercase or sentence case
- Full-width on mobile, auto-width on desktop

**Secondary Actions** (엑셀 다운로드, PDF 인쇄):
- h-10, px-6, rounded-lg
- Icon + text layout
- Grouped in action bar above table

**Icon Buttons**:
- w-10 h-10, rounded-full
- For: refresh, filter, settings

### 5. Mobile-Specific Components

**QR Scanner Interface**:
- Full-screen camera view
- Semi-transparent overlay with scan guide (square frame)
- Cancel button: Top-left, elevated
- Instructions overlay: Bottom, p-4, backdrop-blur
- Success/Error feedback: Full-screen modal with animation

**Guard Home Screen**:
- Large "출근하기" button (h-20, rounded-2xl)
- Today's status card showing current attendance
- Quick stats: 이번 달 출근 일수

### 6. Admin Dashboard Layout

**Section Structure**:
1. **Header** (h-16): Logo, navigation, profile
2. **Action Bar** (h-16): Date selector, export buttons, filters
3. **Stats Row** (py-8): 3-column grid of metric cards
4. **Main Content**: Attendance table with company separation
5. **Footer** (h-12): Minimal - copyright only

**Company Sections**:
- Company logo + name as section header
- Collapsible on mobile for better navigation
- Clear visual separator between companies

---

## Specific Page Implementations

### Admin Dashboard
- Full-width table container with horizontal scroll
- Export buttons fixed in action bar
- Month navigation prominent
- Clear company logo display for each section

### Guard Mobile View
- Card-based layout with generous tap targets
- QR scanner accessed via large floating action button
- Simple, focused interface - one primary action visible
- Success confirmation with checkmark animation

### QR Code Management (Admin)
- Grid of site cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card shows: Site name, QR code preview, 다운로드 button
- Generate new QR: Modal form overlay

---

## Icon Library
**Use Heroicons** (outline for primary, solid for filled states)
- Navigation: home, calendar, user-circle, cog
- Actions: qrcode, download, printer, plus-circle
- States: check-circle, x-circle, exclamation-triangle

---

## Images
No hero images needed. This is a utility application. Use company logos in header and table sections only.