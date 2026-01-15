# Security Guard Attendance Web Application

## Overview

A QR code-based attendance management system for security guards. Guards check in by scanning QR codes at work sites using their smartphones, while administrators monitor attendance in real-time through a dashboard. The application supports two companies (미래ABM and 다원PMC) with role-based access for admins and guards.

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
- Admin: username="admin", password="admin123"
- Guard 1: username="guard1", password="guard123"
- Guard 2: username="guard2", password="guard123"
- Guard 3: username="guard3", password="guard123"

### Key Features
- QR code generation for work sites using the `qrcode` library
- QR scanning via `html5-qrcode` for mobile check-in
- Monthly attendance grid with Excel/PDF export capabilities (xlsx, jspdf)
- Geolocation capture during check-in
- Vacation request management

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