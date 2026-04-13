# AI Brand & Marketing OS — Agent Knowledge Base

This file is the authoritative technical reference for the project. It is always loaded into the AI agent's context. Keep it updated whenever architecture, schema, or major features change.

---

## What This App Does

A self-hosted SaaS platform where teams create brand identities and full social media campaigns using AI. The core loop:

1. User registers/logs in (JWT email+password auth)
2. User creates or joins a workspace (multi-tenant)
3. User fills out a brand form → AI generates a complete brand kit (personality, positioning, color palette, tone of voice, visual style)
4. User launches a campaign → AI generates 7-14 social posts (hook, caption, CTA, hashtags, image prompt)
5. User reviews, edits, and regenerates individual posts; can generate AI images per post or bulk-generate all
6. User exports a brand book PDF or uploads media to the library

---

## Monorepo Layout

```
/
├── artifacts/
│   ├── api-server/         Express API (port 8080), TypeScript + esbuild
│   └── brand-os/           React + Vite frontend
├── lib/
│   ├── db/                 Drizzle ORM schema + pg pool
│   ├── api-zod/            Zod validation schemas (shared FE/BE)
│   ├── api-spec/           OpenAPI spec (source of truth for API client)
│   ├── api-client-react/   TanStack Query hooks (codegen from OpenAPI)
│   └── integrations-openai-ai-server/  OpenAI client via Replit proxy
├── docker-compose.yml      Production Docker Compose (app + postgres)
├── Dockerfile              Node 20 + pnpm multi-stage build
├── pnpm-workspace.yaml
└── README.md
```

---

## Key Files (Memorize These)

| File | Role |
|---|---|
| `artifacts/api-server/src/app.ts` | Express middleware chain (compression, CORS, rate limiting, logging, static storage, error handler) |
| `artifacts/api-server/src/index.ts` | HTTP server entry |
| `artifacts/api-server/src/middlewares/auth.ts` | JWT middleware: requireAuth, optionalAuth, signToken |
| `artifacts/api-server/src/routes/auth.ts` | POST /api/auth/register, /login, GET /api/auth/me |
| `artifacts/api-server/src/routes/workspaces.ts` | Workspace CRUD + member management (owner/admin/editor roles) |
| `artifacts/api-server/src/routes/brands.ts` | All brand endpoints + AI generation |
| `artifacts/api-server/src/routes/campaigns.ts` | GET /campaigns/:id |
| `artifacts/api-server/src/routes/posts.ts` | Edit, regenerate, generate image (saves files to STORAGE_DIR) |
| `artifacts/api-server/src/routes/jobs.ts` | POST /campaigns/:id/generate-all-images (bulk, PostgreSQL job queue) |
| `artifacts/api-server/src/routes/media.ts` | Upload logos/images via multer; list media library |
| `artifacts/api-server/src/routes/export.ts` | GET /brands/:id/export-pdf → PDFKit brand book |
| `artifacts/api-server/src/lib/ai.ts` | generateBrandKit() + generateCampaign() |
| `artifacts/api-server/src/lib/asyncHandler.ts` | Wraps async routes, sends errors to global handler |
| `lib/db/src/index.ts` | pg Pool + Drizzle client (max 10 connections) |
| `lib/db/src/schema/index.ts` | Exports all tables: brands, campaigns, posts, users, workspaces, workspace_members, jobs |
| `artifacts/brand-os/src/App.tsx` | Router + QueryClient + lazy page imports + auth guard |
| `artifacts/brand-os/src/contexts/AuthContext.tsx` | JWT localStorage auth state + login/register/logout helpers |
| `artifacts/brand-os/src/components/Layout.tsx` | Sidebar with workspace switcher, user menu, nav links |
| `artifacts/brand-os/src/pages/Login.tsx` | Login page |
| `artifacts/brand-os/src/pages/Register.tsx` | Register page |
| `artifacts/brand-os/src/pages/BrandWizard.tsx` | 4-step brand creation |
| `artifacts/brand-os/src/pages/BrandKit.tsx` | Brand display + campaign launch |
| `artifacts/brand-os/src/pages/CampaignWorkspace.tsx` | Post edit/regen/image + Generate All Visuals + Export PDF |
| `artifacts/brand-os/src/pages/MediaLibrary.tsx` | Upload + browse stored media files |
| `artifacts/brand-os/src/pages/Team.tsx` | Invite/remove members, manage roles |
| `artifacts/brand-os/src/pages/Settings.tsx` | Workspace + account settings |

---

## Environment Variables

| Variable | Who Sets It | Purpose |
|---|---|---|
| `DATABASE_URL` | Replit PostgreSQL integration | DB connection string |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit OpenAI integration | Proxy base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit OpenAI integration | Proxy API key |
| `PORT` | Replit artifact system | Port for API server (8080) |
| `BASE_PATH` | Replit artifact system | Vite base path for frontend |
| `JWT_SECRET` | Optional env var | JWT signing secret (defaults to dev secret) |
| `STORAGE_DIR` | Optional env var | Directory for uploaded/generated files (default: `cwd/storage`) |

Do NOT hardcode these. Always read from `process.env`.

---

## Database Schema (Drizzle ORM)

### users
- `id` serial PK
- `email` text UNIQUE NOT NULL
- `password_hash` text NOT NULL (bcryptjs)
- `name` text
- `created_at` timestamptz

### workspaces
- `id` serial PK
- `name` text NOT NULL
- `slug` text UNIQUE NOT NULL
- `owner_id` integer FK → users.id
- `created_at` timestamptz

### workspace_members
- `id` serial PK
- `workspace_id` integer FK → workspaces.id CASCADE
- `user_id` integer FK → users.id CASCADE
- `role` text: `owner` | `admin` | `editor`
- `created_at` timestamptz

### jobs
- `id` serial PK
- `type` text NOT NULL (e.g. `generate-all-images`)
- `status` text: `pending` | `running` | `done` | `failed`
- `payload` jsonb
- `result` jsonb nullable
- `error` text nullable
- `created_at`, `updated_at` timestamptz

### brands
- `id` serial PK
- `workspace_id` integer FK → workspaces.id nullable
- `company_name` text NOT NULL
- `company_description` text NOT NULL
- `industry` text NOT NULL
- `website_url` text nullable
- `logo_url` text nullable (base64 JPEG OR `/api/storage/logos/…` path)
- `status` text NOT NULL default `draft` → `kit_ready` → `active`
- `brand_kit` jsonb nullable
- `created_at`, `updated_at` timestamptz

### campaigns / posts
(same as before — see original schema)

**Schema migration:** `pnpm --filter @workspace/db run push`

---

## API Routes Quick Reference

```
# Auth
POST   /api/auth/register        { email, password, name? }  → { token, user }
POST   /api/auth/login           { email, password }          → { token, user }
GET    /api/auth/me              (Bearer token)               → user

# Workspaces
GET    /api/workspaces
POST   /api/workspaces           { name, slug }
GET    /api/workspaces/:id
PATCH  /api/workspaces/:id       { name }
DELETE /api/workspaces/:id
POST   /api/workspaces/:id/members    { email, role }
PATCH  /api/workspaces/:id/members/:userId  { role }
DELETE /api/workspaces/:id/members/:userId

# Brands
GET    /api/health
GET    /api/dashboard/summary
GET    /api/brands
POST   /api/brands               { companyName, companyDescription, industry, websiteUrl?, logoUrl?, brandColors? }
GET    /api/brands/:id
PATCH  /api/brands/:id
DELETE /api/brands/:id
POST   /api/brands/:id/generate-kit
POST   /api/brands/:id/generate-campaign  { brief?, postCount? }
GET    /api/brands/:id/campaigns
GET    /api/brands/:id/stats
GET    /api/brands/:id/export-pdf          → PDF download (PDFKit)

# Campaigns / Posts
GET    /api/campaigns/:id
GET    /api/posts/:id
PATCH  /api/posts/:id
POST   /api/posts/:id/regenerate
POST   /api/posts/:id/generate-image       → saves file to STORAGE_DIR
POST   /api/campaigns/:id/generate-all-images  → enqueues job

# Media
POST   /api/media/upload         multipart: field=file (logo or image)
GET    /api/media                list uploaded files
GET    /api/storage/*            static file serving for stored files
```

---

## File Storage

- All generated images and uploaded files saved to `STORAGE_DIR` (default: `<cwd>/storage`)
- Served statically at `/api/storage/*`
- Image URLs stored as `/api/storage/images/post-{id}-{ts}.png` (not base64)
- Logo uploads go to `storage/logos/`, campaign images to `storage/images/`

---

## Auth System

- JWT (jsonwebtoken) + bcryptjs password hashing
- Token stored in `localStorage` as `brand_os_token`
- `requireAuth` middleware verifies Bearer token on protected routes
- `optionalAuth` for routes that work logged in or not
- AuthContext in React provides `user`, `login()`, `register()`, `logout()`
- Default dev JWT secret: `"dev-secret-change-in-production"` — set `JWT_SECRET` env var in production

---

## Rate Limiting

- Global: 200 req / 15 min per IP (express-rate-limit)
- AI routes (`/api/brands/*/generate-*`, `/api/posts/*/regenerate`, `/api/posts/*/generate-image`): 30 req / 15 min per IP

---

## Job Queue

- PostgreSQL `jobs` table as lightweight queue
- `/api/campaigns/:id/generate-all-images` → inserts job, runs background generation
- Up to 3 concurrent image generation jobs (Promise.allSettled with concurrency limit)
- Status polling not yet implemented (refresh page to see results)

---

## Frontend Routes

| Path | Page |
|---|---|
| `/login` | Login |
| `/register` | Register |
| `/` | Dashboard (auth-protected) |
| `/brands/new` | BrandWizard |
| `/brands/:id` | BrandKit |
| `/brands/:id/edit` | BrandEdit |
| `/brands/:id/campaigns` | CampaignList |
| `/campaigns/:id` | CampaignWorkspace (Generate All Visuals + Export PDF) |
| `/media` | MediaLibrary |
| `/team` | Team management |
| `/settings` | Settings |

All routes except `/login` and `/register` require authentication. Unauthenticated users are redirected to `/login`.

---

## Docker Deployment

```bash
docker-compose up -d
```

- `Dockerfile`: Node 20, pnpm build, production start
- `docker-compose.yml`: app (port 3000→8080) + postgres with healthcheck + named volumes
- Set `JWT_SECRET`, `STORAGE_DIR`, and `DATABASE_URL` environment variables in production

---

## Development Workflows (Replit)

| Workflow | Command | Port |
|---|---|---|
| Start application | `BASE_PATH=/ PORT=18565 pnpm --filter @workspace/brand-os run dev & PORT=8080 pnpm --filter @workspace/api-server run dev` | 18565 (FE) + 8080 (API) |

**Important:** Only the "Start application" workflow should be running. The artifact-specific sub-workflows (`artifacts/api-server: API Server`, `artifacts/brand-os: web`) conflict on ports and should remain stopped.

---

## How to Add a New Feature

### New API endpoint:
1. Add route handler in `artifacts/api-server/src/routes/` using `asyncHandler()`
2. Mount in `artifacts/api-server/src/routes/index.ts`
3. Optionally add to `lib/api-spec/` OpenAPI spec and run codegen

### New database column/table:
1. Edit schema in `lib/db/src/schema/`
2. Export from `lib/db/src/schema/index.ts`
3. Run `pnpm --filter @workspace/db run push`

### New frontend page:
1. Create component in `artifacts/brand-os/src/pages/`
2. Add lazy import in `App.tsx`
3. Add `<Route>` in the `<Switch>`

---

## Known Issues / Tech Debt

- Job queue polling not implemented — user must refresh page to see bulk image generation results
- Workspace switcher in sidebar is UI-only — not yet wired to filter brands by workspace
- Logo uploads accept base64 (legacy) or file path — ensure consistency when editing brand
