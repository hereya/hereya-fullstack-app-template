# Hereya Fullstack App Template

React Router v7 fullstack app with SSR, passwordless authentication (email OTP + WebAuthn passkeys), Prisma 7, and Tailwind CSS v4.

## Working with Users

The users of this template are **non-technical**. When interacting with them:
- **Never ask technical questions** (e.g., "which database field type?", "should we use a join table?"). Make those decisions yourself.
- **Help them clarify requirements** by asking about their goals in plain language (e.g., "Should any user be able to do this, or only admins?").
- **Be proactive with all technical decisions** — architecture, data modeling, naming, validation rules, error handling. Just build it.
- If multiple valid approaches exist, pick the simplest one and go with it.
- **After every modification, display the app URL** (http://localhost:5177) with the relevant path so the user can open it and see the changes.
- **Commit changes regularly** with clear, comprehensive commit messages. Do not ask the user — just commit after completing each logical unit of work. The user does not know what git is.

## Tech Stack

- **Framework**: React 19, React Router 7.12 (SSR enabled)
- **Database**: PostgreSQL via Prisma 7 with driver adapters (`@prisma/adapter-pg`)
- **Auth**: Passwordless — email OTP (Postmark) + WebAuthn passkeys (`@simplewebauthn/server`)
- **Styling**: Tailwind CSS v4 with Material Design 3 theme
- **Testing**: Vitest with per-test database isolation
- **Infra**: Hereya (provisions and injects env vars at runtime)

## Development Workflow

**MANDATORY: Before making ANY code changes, agents MUST run the full dev setup and verify tests pass:**

1. `npm install` — Install dependencies
2. `hereya up` — Provision dev infra + export env vars
3. `npm run test:up` — Provision test infra
4. Kill any existing dev server process on port 5177 before starting a new one
5. `npm run dev` — Start dev server on port 5177 (run in background)
6. `npm run test -- run` — Run all tests and verify they pass
7. Only after all tests pass, proceed with code changes
8. After changes, run `npm run test -- run` again to confirm nothing is broken

```bash
hereya up                  # 1. Provision dev infra + export env vars
npm run test:up            # 2. Provision test infra (run once per session)
npm run dev                # 3. Start dev server on port 5177
npm run test               # 4. Run tests in watch mode
npm run test -- run        # 5. Run tests once and exit
# When done (optional):
hereya down                # Tear down dev infra
npm run test:down          # Tear down test infra
# Or keep them running for future sessions if local data matters
```

Deploy to staging: `hereya deploy -w hereya-staging`

**Note:** The first deployment can take 10+ minutes due to Aurora database and ECS cluster creation. This is normal — do not cancel or retry. Subsequent deployments will be much faster.

## Environment Variables

All env vars are managed by Hereya. **Never create `.env` files.** Check available vars with `hereya env -l`.

| Variable | Source | Purpose |
|---|---|---|
| `POSTGRES_URL` | hereya/postgres | Database connection string |
| `POSTGRES_ROOT_URL` | hereya/postgres | Root connection (for creating test DBs) |
| `POSTMARK_SERVER_KEY` | hereya/postmark-client | Email API key |
| `SESSION_SECRET` | hereya/session-secret | Cookie signing secret |
| `AUTH_EMAIL` | hereyaconfig/hereyastaticenv | Sender email for login codes |
| `APP_URL` | hereyaconfig/hereyastaticenv | App origin for WebAuthn RP config |
| `bucketName` | aws/s3bucket | S3 bucket name for file storage |
| `awsRegion` | aws/s3bucket | AWS region of the S3 bucket |

To run any command that needs env vars: `hereya run -- <command>`

## Project Structure

```
app/
├── lib/                        # Server-side utilities
│   ├── auth.server.ts          # Session management, requireUser, requireAdmin
│   ├── db.server.ts            # Prisma client singleton (PrismaPg adapter)
│   ├── mail.server.ts          # Postmark email wrapper
│   ├── storage.server.ts       # S3 file storage (upload, download, presigned URLs)
│   └── webauthn.server.ts      # WebAuthn registration/authentication
├── routes/                     # Page and API routes
│   ├── home.tsx                # / — redirects to dashboard or login
│   ├── dashboard.tsx           # /dashboard — protected user page
│   ├── profile.tsx             # /profile — passkey management + user profile
│   ├── admin/users.tsx         # /admin/users — admin user management
│   └── auth/
│       ├── login.tsx           # /auth/login — email + passkey login
│       ├── code.tsx            # /auth/code — OTP verification
│       ├── logout.tsx          # /auth/logout
│       ├── passkey.register.ts # /auth/passkey/register — API
│       └── passkey.authenticate.ts # /auth/passkey/authenticate — API
├── routes.ts                   # Route definitions — register new routes here
├── root.tsx                    # Root layout
└── app.css                     # Global styles + theme
prisma/
├── schema.prisma               # Database models (User, LoginCode, Passkey)
└── migrations/                 # Migration files
test/
├── setup.ts                    # Vitest setup (cleanup, mocks, polyfills)
├── test-db-helpers.ts          # prepareTestDatabase() — per-test DB isolation
└── user-helpers.ts             # createTestUser() factory
```

## Key Conventions

### Prisma
- Prisma 7 with driver adapters — no `datasources.db.url`, use `@prisma/adapter-pg`
- Generated client at `app/generated/` — import from `~/generated/prisma/client/client`
- Config in `prisma.config.ts`, schema in `prisma/schema.prisma`
- After schema changes: `npx prisma generate` then `npm run typecheck`
- Create migrations: `hereya run -- npx prisma migrate dev --name <name>`
- **MANDATORY: After any database change (schema changes, migrations), you MUST restart the full dev workflow:**
  1. Stop the dev server
  2. Run `npm run test:down` then `npm run test:up` to reprovision test infra
  3. Run `npm run dev` to restart the dev server
  4. Run `npm run test -- run` to verify all tests still pass

### Routes
- Route types imported from `./+types/<routename>`
- Server-only code lives in `.server.ts` files
- New routes must be registered in `app/routes.ts`
- Protected routes: use `requireUser(request)` from `~/lib/auth.server`
- Admin-only routes: use `requireAdmin(request)` from `~/lib/auth.server`
- **NEVER add authentication or protection to the `/health` route** — it must remain unauthenticated. ECS uses this endpoint for health checks during deployment, and protecting it will cause deployments to fail.

### Navigation
- Use React Router's `<Link>` and `<NavLink>` components for all internal links — never plain `<a>` tags
- Import from `react-router`: `import { Link, NavLink } from "react-router"`
- Plain `<a>` tags are only for external URLs

### Testing
- **Every new feature must include automated tests.**
- Tests colocated with source: `app/routes/auth/login.test.ts`
- Each test suite gets an isolated database via `prepareTestDatabase()` from `test/test-db-helpers.ts`
- User fixtures via `createTestUser(db, email?, opts?)` from `test/user-helpers.ts`
- Run: `npm run test` (watch) or `npm run test -- run` (once)

### Type Checking
```bash
npm run typecheck    # Runs: react-router typegen && tsc
```
