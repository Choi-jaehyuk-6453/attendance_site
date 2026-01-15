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
- Vacation request management (planned feature, marked as "준비중")

### Sidebar Navigation Structure
- **출근관리**: 출근기록부 (dashboard), QR 관리
- **휴가관리**: 휴가 신청 현황 (planned)
- **기초관리**: 현장 관리, 근무자 관리

### Admin Routes
- `/admin` - 출근기록부 (attendance records, requires site selection)
- `/admin/qr` - QR 코드 관리
- `/admin/sites` - 현장 관리
- `/admin/users` - 근무자 관리

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
- **Date Handling**: `date-fns` with Korean locale support
- **Export**: `xlsx` for Excel files, `jspdf` with `jspdf-autotable` for PDF generation
- **Validation**: Zod schemas with `drizzle-zod` for database-schema integration

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` for development error display
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` for Replit integration