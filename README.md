# Hereya Fullstack App Template

A production-ready fullstack app template with passwordless authentication, admin panel, and infrastructure managed by [Hereya](https://hereya.io).

## Features

- Server-side rendering with React Router v7
- Passwordless authentication (email OTP + WebAuthn passkeys)
- Admin user management (activate/deactivate users)
- PostgreSQL with Prisma 7
- Tailwind CSS v4 with Material Design 3 theme (light/dark mode)
- Vitest testing with per-test database isolation
- Infrastructure provisioning and env var injection via Hereya
- Docker-based deployment to AWS ECS

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [Hereya CLI](https://hereya.io) installed and configured
- Docker (for local PostgreSQL provisioning)

## Getting Started

```bash
# Install dependencies
npm install

# Provision dev infrastructure (PostgreSQL, session secret, etc.)
hereya up

# Provision test infrastructure (run once per session)
npm run test:up

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5177`.

## Development Workflow

```bash
npm run dev              # Start dev server (port 5177)
npm run test             # Run tests in watch mode
npm run test -- run      # Run tests once and exit
npm run typecheck        # Type check the project
```

## Environment Variables

All environment variables are managed by Hereya. **Do not create `.env` files.**

To see available variables:

```bash
hereya env -l
```

Key variables (injected automatically):

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | Database connection string |
| `POSTMARK_SERVER_KEY` | Email API key (login codes) |
| `SESSION_SECRET` | Cookie signing secret |
| `AUTH_EMAIL` | Sender address for login emails |
| `APP_URL` | Application URL (WebAuthn config) |

## Database

The project uses Prisma 7 with PostgreSQL. After modifying `prisma/schema.prisma`:

```bash
# Create a migration
hereya run -- npx prisma migrate dev --name <migration-name>

# Regenerate the client
npx prisma generate
```

## Testing

Tests use Vitest with isolated databases per test suite:

```bash
# Provision test infra (once per session)
npm run test:up

# Run tests
npm run test             # Watch mode
npm run test -- run      # Run once

# Tear down test infra (optional)
npm run test:down
```

## Deployment

### Staging

```bash
hereya deploy -w hereya-staging
```

### Production

The app deploys as a Docker container to AWS ECS via Hereya. The `Dockerfile` handles building and running the production server, including database migrations on startup.

## Teardown

When done developing, optionally tear down local resources:

```bash
hereya down              # Dev infrastructure
npm run test:down        # Test infrastructure
```

Or keep them running for future sessions if preserving local data is important.
