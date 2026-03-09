# CrustyHelpdesk — Setup Guide

## Prerequisites

| Dependency | Minimum Version | Check Command |
|---|---|---|
| Node.js | 18.x+ | `node -v` |
| npm | 9.x+ | `npm -v` |
| Git | any | `git --version` |

**No database server required** — CrustyHelpdesk uses SQLite (file-based).

## Quick Start

```bash
# 1. Clone and enter the project
git clone <your-repo-url> crustyhelpdesk
cd crustyhelpdesk

# 2. Install Node dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env if needed (defaults work for local development)

# 4. Run the installer (creates DB schema + admin account)
#    Option A — via PHP (if you have a PHP-enabled webserver):
#    Navigate to http://your-server/install.php in a browser
#
#    Option B — via command line:
npx prisma generate
npx prisma migrate dev --name init
npx tsx prisma/seed.ts

# 5. Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Default Admin Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |

**Change this password immediately in production.**

## Environment Variables (.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite database file path |
| `AUTH_SECRET` | Yes | (example value) | NextAuth session signing secret. Generate with `openssl rand -base64 32` |
| `AUTH_PROVIDER` | Yes | `local` | Auth mode: `local` (credentials in DB) or `ldap` (future) |

## npm Packages (installed by `npm install`)

### Runtime Dependencies
| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | React framework (App Router) |
| `react` | 19.2.3 | UI library |
| `react-dom` | 19.2.3 | React DOM renderer |
| `@prisma/client` | ^7.4.2 | Database ORM client |
| `prisma` | ^7.4.2 | Database ORM CLI + migration engine |
| `next-auth` | ^5.0.0-beta.30 | Authentication (NextAuth v5) |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `zod` | ^4.3.6 | Input validation schemas |
| `dotenv` | ^17.3.1 | Environment variable loading |

### Dev Dependencies
| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5 | TypeScript compiler |
| `tailwindcss` | ^4 | Utility-first CSS |
| `@tailwindcss/postcss` | ^4 | Tailwind PostCSS integration |
| `tsx` | ^4.21.0 | TypeScript execution (for seed script) |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.1.6 | Next.js ESLint rules |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^19 | React type definitions |
| `@types/react-dom` | ^19 | React DOM type definitions |
| `@types/bcryptjs` | ^2.4.6 | bcryptjs type definitions |

## Database Schema

SQLite database with 4 tables:

- **User** — id, username (unique), displayName, email (unique), passwordHash, role (ADMIN/TECHNICIAN)
- **Ticket** — id, title, description, clientMachine, status, issueTimeStart, issueTimeEnd, createdById (FK → User)
- **LogRequest** — id, ticketId (FK → Ticket), status, logType, timeRangeStart, timeRangeEnd, errorMessage
- **LogEntry** — id, logRequestId (FK → LogRequest), eventId, level, source, message, timestamp, rawXml

## Available npm Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `next dev` | Start development server (port 3000) |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Start production server |
| `npm run lint` | `eslint` | Run linter |
| `npm run db:seed` | `npx tsx prisma/seed.ts` | Seed admin user |

## Production Deployment

```bash
npm run build
npm run start
```

Set `AUTH_SECRET` to a strong random value and change the default admin password.

## install.php

A PHP-based installer is included at the project root (`install.php`). When accessed via a browser on a PHP-enabled webserver, it will:

1. Check that Node.js (>=18) and npm (>=9) are installed
2. Run `npm install` if `node_modules/` is missing
3. Generate the Prisma client
4. Run the database migration to create all tables
5. Seed the default admin account (admin / admin)
6. Report success or failure for each step

**Delete `install.php` after setup is complete.** It should not remain accessible on a production server.
