# 경비원 근태관리 (Security Guard Attendance Web Application)

## Overview

A QR code-based attendance management system for security guards (경비원 근태관리). Guards check in by scanning QR codes at work sites using their smartphones, while administrators monitor attendance in real-time through a dashboard. The application is branded for 미래에이비엠 (MIRAE ABM) with role-based access for admins and guards.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Design System**: Material Design-inspired with Korean language support (Noto Sans KR font)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON API under `/api` prefix
- **Build**: esbuild for production bundling with Vite for development HMR

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions using drizzle-orm/pg-core
- **Migrations**: Drizzle Kit manages schema migrations in `./migrations` directory
- **Key Tables**: users, sites, attendanceLogs, vacationRequests with proper relations

### Authentication
- **Method**: Session-based authentication with express-session
- **Password Security**: bcryptjs for password hashing (10 rounds)
- **Session**: Server-side sessions with client-side auth context (`useAuth` hook)
- **Authorization**: Middleware for role-based access control on API routes
- **Role-based Access**: Two roles - "admin" (dashboard access) and "guard" (mobile check-in)
- **Company Segmentation**: Users belong to either "mirae_abm" or "dawon_pmc" company

### Test Accounts
- Admin: username="관리자", password="admin123"
- Guards: username = 본인 이름, password = 전화번호 끝 4자리

### User Management
- Guards are assigned to specific sites (siteId field in users table)
- Guard username is their real name
- Guard password is automatically set to last 4 digits of their phone number
- New guards can be added via 근무자 관리 page

### Key Features
- QR code generation for work sites using the `qrcode` library
- QR scanning via `html5-qrcode` for mobile check-in
- Monthly attendance grid with Excel/PDF export capabilities (xlsx, jspdf)
- PDF export uses Noto Sans KR font for proper Korean text rendering
- Export filenames include site name when a site is selected
- Geolocation capture during check-in
- Site-based guard management (guards are assigned to specific sites)
- All date/time operations use Korean Standard Time (KST, Asia/Seoul) via `shared/kst-utils.ts`
- Complete vacation management system

### Vacation Management System
- **Annual Leave Calculation**: Based on Korean labor law
  - Under 1 year service: 1 day per month (expires after 1 year)
  - 1+ years service: 15 days per year (valid for 2 years)
  - 3+ years service: 15 days + 1 day per 2 years of service (max 25 days)
- **Vacation Types**: 연차 (annual), 반차 (half-day), 병가 (sick), 경조사 (family_event), 기타 (other)
- **Guard Features** (`/guard/vacation`):
  - View leave balance with detailed accrual breakdown
  - Submit vacation requests with date range and reason
  - View request history and status
- **Admin Features**:
  - `/admin/vacation-requests`: Approve/reject/delete vacation requests, send email with PDF
  - `/admin/vacation-status`: View vacation status by site/person, directly add/edit/delete vacation records
  - Admin-created vacations are auto-approved
  - PDF export of vacation requests and status reports
  - Email integration for sending vacation documents to contacts
- **Vacation-Attendance Integration**:
  - When vacation is approved, attendance records are automatically created for each vacation day
  - Attendance grid displays vacation types with different symbols: 연(연차), 반(반차), 병(병가), 경(경조사), 기(기타)
  - Admin can edit these vacation-based attendance records from the attendance grid
  - Deleting a vacation request also removes the associated attendance records
- **Key Files**: 
  - `shared/leave-utils.ts` - Annual leave calculation logic
  - `server/vacation-pdf-generator.ts` - PDF generation for vacation documents

### Email Configuration
- **Provider**: Naver Mail SMTP (smtp.naver.com:587)
- **Required Secrets**: NAVER_EMAIL, NAVER_EMAIL_PASSWORD
- **Features**: Attendance PDF email sending to registered contacts
- **Setup**: User must enable POP3/SMTP in Naver Mail settings and generate app password

### Sidebar Navigation Structure
- **출근관리**: 출근기록부 (dashboard), QR 관리
- **휴가관리**: 휴가 신청 현황, 휴가 현황
- **기초관리**: 현장 관리, 근무자 관리, 담당자 관리

### Admin Routes
- `/admin` - 출근기록부 (attendance records, requires site selection)
- `/admin/qr` - QR 코드 관리
- `/admin/vacation-requests` - 휴가 신청 현황 (approve/reject vacation requests)
- `/admin/vacation-status` - 휴가 현황 (view/edit vacation status by site/person)
- `/admin/sites` - 현장 관리
- `/admin/users` - 근무자 관리
- `/admin/contacts` - 담당자 관리

### Guard Routes
- `/guard` - Guard home (QR scan check-in)
- `/guard/vacation` - 휴가 신청 및 현황 (view balance, submit requests)

### Path Aliases
- `@/*` maps to `./client/src/*`
- `@shared/*` maps to `./shared/*`
- `@assets` maps to `./attached_assets`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: PostgreSQL session store for Express

### Third-Party Libraries
- **QR Code**: `qrcode` for generation, `html5-qrcode` for scanning
- **Date Handling**: `date-fns` with `date-fns-tz` for Korean timezone (KST, Asia/Seoul) support and Korean locale
- **Export**: `xlsx` for Excel files, `jspdf` with `jspdf-autotable` for PDF generation
- **Validation**: Zod schemas with `drizzle-zod` for database-schema integration

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` for development error display
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` for Replit integration