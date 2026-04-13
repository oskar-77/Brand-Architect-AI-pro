# AI Brand & Marketing OS

A full-stack web application that uses AI to generate complete brand identities and social media campaigns. Users enter their company details, upload a logo, and the system produces a brand kit (personality, positioning, color palette, tone of voice) plus a ready-to-publish multi-day social media campaign with captions, hooks, hashtags, and AI-generated image prompts.

---

## Table of Contents

- [Live Demo](#live-demo)
- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [AI System](#ai-system)
- [Frontend Architecture](#frontend-architecture)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Development Workflows](#development-workflows)
- [Extending the Project](#extending-the-project)
- [Known Limitations & Future Work](#known-limitations--future-work)

---

## Live Demo

This project is designed to run on [Replit](https://replit.com). Fork the Replit project and all infrastructure (database, OpenAI API access) is provisioned automatically.

---

## Feature Overview

| Feature | Description |
|---|---|
| Brand Wizard | 4-step form: company info → logo upload → review → AI generation |
| Logo Color Extraction | Extracts dominant colors from the uploaded logo using Canvas API |
| Brand Kit Generation | AI generates personality, positioning, tone of voice, audience segments, color palette, visual style |
| Brand Kit Display | Full brand kit page with color swatches, style badge, statistics |
| Brand Editing | Edit company name, description, industry, website, logo after creation |
| Campaign Generation | AI creates a multi-day social media campaign with a brief/post count option |
| Campaign Workspace | View all posts per campaign, edit content inline, regenerate individual posts |
| AI Image Generation | Generate an AI image per post using `gpt-image-1` |
| Dashboard | Summary stats (total brands, campaigns, posts) + recent brands list |

---

## Tech Stack

### Frontend (`artifacts/brand-os`)
- **React 19** with TypeScript
- **Vite 7** (dev server + build tool, with manual chunk splitting)
- **Wouter** — lightweight client-side router
- **TanStack Query v5** — server state management with 5-minute cache
- **Tailwind CSS v4** — utility-first styling
- **Radix UI** — accessible headless components (tooltip, dialog, dropdown)
- **Lucide React** — icon library
- **React.lazy + Suspense** — code-split pages for faster initial load

### Backend (`artifacts/api-server`)
- **Node.js** with **Express 5**
- **TypeScript** compiled with **esbuild**
- **Drizzle ORM** — type-safe SQL query builder
- **PostgreSQL** via `pg` connection pool (max 10 connections)
- **compression** — Gzip middleware (~70% payload reduction)
- **pino** — structured JSON logging
- **Zod** — request validation on all routes

### Shared Libraries (`lib/`)
| Package | Purpose |
|---|---|
| `@workspace/db` | Drizzle schema, DB client, table exports |
| `@workspace/api-zod` | Zod schemas for all API request/response shapes |
| `@workspace/api-spec` | OpenAPI specification (auto-generated) |
| `@workspace/api-client-react` | TanStack Query hooks auto-generated from the OpenAPI spec |
| `@workspace/integrations-openai-ai-server` | OpenAI client using Replit AI proxy |

### AI
- **OpenAI `gpt-5-nano`** — text generation (brand kit, campaigns, post regeneration)
- **OpenAI `gpt-image-1`** — image generation per social post
- Access via **Replit AI Integrations proxy** — no API key required from the user

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/              Express API server (port 8080)
│   │   └── src/
│   │       ├── app.ts           Express app (middleware chain)
│   │       ├── index.ts         Server entry point (keep-alive config)
│   │       ├── routes/
│   │       │   ├── index.ts     Mounts all routers under /api
│   │       │   ├── brands.ts    Brand CRUD + AI generation endpoints
│   │       │   ├── campaigns.ts Campaign fetch endpoint
│   │       │   ├── posts.ts     Post edit, regenerate, image generation
│   │       │   ├── dashboard.ts Dashboard summary (parallel queries)
│   │       │   └── health.ts    GET /api/health → { status: "ok" }
│   │       └── lib/
│   │           ├── ai.ts        generateBrandKit() + generateCampaign()
│   │           ├── asyncHandler.ts  Wraps async route handlers (catches errors)
│   │           └── logger.ts    Pino logger instance
│   │
│   └── brand-os/               React frontend
│       └── src/
│           ├── App.tsx          Router + QueryClient + lazy page imports
│           ├── pages/
│           │   ├── Dashboard.tsx       Home page with stats + recent brands
│           │   ├── BrandWizard.tsx     4-step brand creation flow
│           │   ├── BrandKit.tsx        Brand identity display + campaign launch
│           │   ├── BrandEdit.tsx       Edit brand details
│           │   ├── CampaignList.tsx    List all campaigns for a brand
│           │   ├── CampaignWorkspace.tsx  View/edit/regenerate posts
│           │   └── not-found.tsx       404 page
│           ├── components/
│           │   ├── Layout.tsx          Sidebar nav + mobile header + data prefetch
│           │   └── ui/                 Shadcn-style Radix components
│           └── lib/
│               ├── colorExtractor.ts   Canvas-based logo color extraction
│               └── utils.ts            cn() helper
│
├── lib/
│   ├── db/                      Drizzle ORM + PostgreSQL
│   │   └── src/
│   │       ├── index.ts         Pool + Drizzle client export
│   │       └── schema/
│   │           ├── index.ts     Re-exports all tables
│   │           ├── brands.ts    brands table schema
│   │           ├── campaigns.ts campaigns table schema
│   │           └── posts.ts     posts table schema
│   ├── api-zod/                 Zod validation schemas (shared between FE/BE)
│   ├── api-spec/                OpenAPI spec (generated from Zod schemas)
│   ├── api-client-react/        TanStack Query hooks (generated from OpenAPI spec)
│   └── integrations-openai-ai-server/  OpenAI client (Replit proxy)
│
├── pnpm-workspace.yaml          Monorepo config + package catalog
├── package.json                 Root scripts (build, typecheck)
└── README.md                    This file
```

---

## Database Schema

All tables use PostgreSQL via Drizzle ORM. Run `cd lib/db && pnpm run push` to apply schema.

### `brands`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | Auto-increment |
| `company_name` | text NOT NULL | |
| `company_description` | text NOT NULL | |
| `industry` | text NOT NULL | One of 18 preset categories |
| `website_url` | text | Optional |
| `logo_url` | text | Base64 JPEG data URL (compressed to max 800px) |
| `status` | text NOT NULL | `draft` → `kit_ready` → `active` |
| `brand_kit` | jsonb | See Brand Kit JSON structure below |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated on change |

**Brand Kit JSON structure** (stored in `brand_kit` column):
```json
{
  "personality": "string",
  "positioning": "string",
  "toneOfVoice": "string",
  "audienceSegments": ["string", "string", "string"],
  "visualStyle": "tech | luxury | bold | minimal",
  "colorPalette": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "accent": "#HEX",
    "background": "#HEX",
    "text": "#HEX"
  },
  "visualStyleRules": "string"
}
```

### `campaigns`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `brand_id` | integer FK | → brands.id ON DELETE CASCADE |
| `title` | text NOT NULL | AI-generated campaign title |
| `strategy` | text NOT NULL | 2-3 sentence campaign strategy |
| `days` | jsonb NOT NULL | Array of day objects (day, objective, postConcept, marketingAngle, cta) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `posts`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `campaign_id` | integer FK | → campaigns.id ON DELETE CASCADE |
| `day` | integer NOT NULL | 1-indexed day number in campaign |
| `caption` | text NOT NULL | Full post body |
| `hook` | text NOT NULL | Opening attention-grabbing line |
| `cta` | text NOT NULL | Call to action |
| `hashtags` | text[] NOT NULL | Array of hashtag strings |
| `image_prompt` | text NOT NULL | DALL-E/Midjourney prompt |
| `image_url` | text | Base64 PNG data URL (generated on demand) |
| `platform` | text NOT NULL | Default `instagram` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## API Reference

Base URL: `/api` (port 8080 in development)

All error responses return `{ "error": "message string" }`.

### Health

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `{ "status": "ok" }` |

### Dashboard

| Method | Path | Response |
|---|---|---|
| GET | `/api/dashboard/summary` | `{ totalBrands, totalCampaigns, totalPosts, recentBrands[] }` |

### Brands

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/brands` | — | Brand[] (list, ordered by newest) |
| POST | `/api/brands` | `{ companyName, companyDescription, industry, websiteUrl?, logoUrl?, brandColors? }` | Brand |
| GET | `/api/brands/:id` | — | Brand (full, including brandKit) |
| PATCH | `/api/brands/:id` | Partial brand fields | Brand |
| DELETE | `/api/brands/:id` | — | 204 No Content |
| POST | `/api/brands/:id/generate-kit` | `{ brandColors?: string[] }` | Brand (with brandKit populated, status → `kit_ready`) |
| POST | `/api/brands/:id/generate-campaign` | `{ brief?: string, postCount?: number (1-14, default 7) }` | Campaign (with posts[]) |
| GET | `/api/brands/:id/campaigns` | — | Campaign[] with posts[] |
| GET | `/api/brands/:id/stats` | — | `{ brandId, totalCampaigns, totalPosts, brandKitGenerated, lastCampaignDate }` |

### Campaigns

| Method | Path | Response |
|---|---|---|
| GET | `/api/campaigns/:id` | Campaign with posts[] ordered by day |

### Posts

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/posts/:id` | — | Post |
| PATCH | `/api/posts/:id` | `{ caption?, hook?, cta?, hashtags?, imagePrompt?, platform? }` | Post |
| POST | `/api/posts/:id/regenerate` | — | Post (AI rewrites all content fields) |
| POST | `/api/posts/:id/generate-image` | — | Post (imageUrl populated with base64 PNG) |

---

## AI System

All AI calls go through `artifacts/api-server/src/lib/ai.ts`.

### `generateBrandKit(companyName, companyDescription, industry, brandColors?)`

- Calls `gpt-5-nano` with `max_completion_tokens: 8192`
- Returns structured JSON: personality, positioning, toneOfVoice, audienceSegments, visualStyle, colorPalette, visualStyleRules
- If `brandColors` is provided (extracted from logo), uses them as the color palette foundation
- Falls back to `buildFallbackKit()` if JSON parse fails

### `generateCampaign(companyName, companyDescription, industry, brandKit, brief?, postCount?)`

- Calls `gpt-5-nano` with `max_completion_tokens: 8192`
- `postCount` is clamped to 1-14 (default 7)
- Returns `{ title, strategy, days[], posts[] }`
- Each post includes: day, platform, hook, caption, cta, hashtags[], imagePrompt
- Falls back to `buildFallbackCampaign()` if JSON parse fails

### Post Regeneration (`POST /api/posts/:id/regenerate`)

- Fetches post → campaign → brand for full context
- Calls `gpt-5-nano` to rewrite hook, caption, cta, hashtags, imagePrompt
- Returns fresh post content without changing day/platform

### Image Generation (`POST /api/posts/:id/generate-image`)

- Uses `gpt-image-1` at `1024x1024`
- Saves as base64 PNG data URL in `posts.image_url`
- Called per-post on demand (not in bulk during campaign generation)

---

## Frontend Architecture

### Routing

Wouter handles client-side routing. All routes defined in `App.tsx`:

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Stats + recent brands |
| `/brands/new` | BrandWizard | 4-step creation flow |
| `/brands/:id` | BrandKit | Brand identity display |
| `/brands/:id/edit` | BrandEdit | Edit brand details |
| `/brands/:id/campaigns` | CampaignList | All campaigns for brand |
| `/campaigns/:id` | CampaignWorkspace | Edit posts in a campaign |

### Data Fetching

TanStack Query hooks from `@workspace/api-client-react` (auto-generated from OpenAPI spec):

- `useListBrands()` — all brands
- `useGetBrand(id)` — single brand with brandKit
- `useGetBrandStats(id)` — campaigns count, posts count, kit status
- `useGetDashboardSummary()` — dashboard totals
- `useCreateBrand()` — mutation
- `useGenerateBrandKit()` — mutation (20-40s AI call)
- `useGenerateCampaign()` — mutation (20-40s AI call)
- `useGetCampaign(id)` — campaign with posts
- `useUpdatePost()` — patch post fields
- `useRegeneratePost()` — AI rewrite
- `useGeneratePostImage()` — AI image per post

**Cache settings:** `staleTime: 5 minutes`, `gcTime: 15 minutes`, `refetchOnWindowFocus: false`

### Data Prefetching

`Layout.tsx` prefetches dashboard summary and brands list on mount using raw `fetch()`, then injects into QueryClient cache with `setQueryData()`. This makes the Dashboard feel instant on first load.

### Logo Color Extraction

`lib/colorExtractor.ts` uses the HTML5 Canvas API to sample pixel colors from the uploaded logo and extract the N most dominant hex colors. These are passed to the AI during brand kit generation so the color palette matches the actual logo.

---

## Environment Variables

These are set automatically on Replit. For local development, create a `.env` file:

```env
# Required — PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/brandos

# Required — OpenAI access via Replit AI Integrations proxy
# On Replit: set automatically when you enable the OpenAI integration
# Locally: use your own OpenAI API key and base URL
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...

# Required — set by Replit/artifact system
PORT=8080              # API server port
BASE_PATH=/brand-os    # Frontend base path (for Vite)
```

---

## Getting Started

### On Replit (Recommended)

1. Fork the Replit project
2. Enable **OpenAI AI Integration** in the Integrations panel
3. Enable **PostgreSQL Database** in the Integrations panel
4. Run `cd lib/db && pnpm run push` in the Shell to create tables
5. Both workflows start automatically (API server + web frontend)

### Local Development

**Prerequisites:** Node.js 20+, pnpm 9+, PostgreSQL 15+

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and OpenAI key

# 3. Push database schema
cd lib/db && pnpm run push && cd ../..

# 4. Start API server (terminal 1)
PORT=8080 pnpm --filter @workspace/api-server run dev

# 5. Start frontend (terminal 2)
BASE_PATH=/ pnpm --filter @workspace/brand-os run dev
```

---

## Development Workflows

### Adding a New API Route

1. Add Zod schemas to `lib/api-zod/src/` for request/response validation
2. Add the route handler in `artifacts/api-server/src/routes/` using `asyncHandler()`
3. Mount the router in `artifacts/api-server/src/routes/index.ts`
4. Update the OpenAPI spec in `lib/api-spec/`
5. Regenerate the React query hooks: `pnpm --filter @workspace/api-client-react run codegen`

### Modifying the Database Schema

1. Edit the table definition in `lib/db/src/schema/`
2. Run `cd lib/db && pnpm run push` to apply changes
3. Update Zod schemas and API routes as needed

### Adding a New Frontend Page

1. Create the page component in `artifacts/brand-os/src/pages/`
2. Add a lazy import in `App.tsx`
3. Add a `<Route>` in the `<Switch>` in `App.tsx`

### Regenerating API Client

The React query hooks in `@workspace/api-client-react` are auto-generated from the OpenAPI spec. After changing routes or Zod schemas:

```bash
pnpm --filter @workspace/api-client-react run codegen
```

---

## Extending the Project

### Ideas for Next Features

| Feature | Where to build |
|---|---|
| User authentication | Add Clerk or Replit Auth; add `userId` FK to `brands` table |
| Export campaign to PDF | New route `GET /api/campaigns/:id/export`; use `pdfkit` or `puppeteer` |
| Bulk image generation | Loop `generateImageBuffer()` for all posts in a campaign |
| Social platform scheduling | Integrate Meta/LinkedIn/Twitter API; add `scheduledAt` column to `posts` |
| Brand templates | Pre-built brand kit templates to skip AI generation |
| Multi-language campaigns | Add `language` field to campaign generation prompt |
| Image style control | Let user pick Midjourney-style modifiers before image generation |
| Analytics dashboard | Track post edits, regenerations, image generations per brand |
| Webhook notifications | Send Slack/email when campaign generation finishes |
| Team collaboration | Add `workspaces` table with multiple users per brand |

### AI Model Switching

To change the text generation model, edit `artifacts/api-server/src/lib/ai.ts`:

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",  // change this
  ...
});
```

To change the image model, edit `artifacts/api-server/src/routes/posts.ts`:

```typescript
const imageBuffer = await generateImageBuffer(post.imagePrompt, "1024x1024");
```

The `generateImageBuffer` function is in `lib/integrations-openai-ai-server/`.

---

## Known Limitations & Future Work

- **Images are stored as base64 in PostgreSQL** — this is fine for MVP but does not scale. The correct solution is to upload to object storage (S3/R2) and store a URL. See the `object-storage` skill on Replit.
- **No authentication** — all brands are accessible to anyone with the URL. Add auth before making this multi-tenant.
- **Logo is stored as base64 in PostgreSQL** — same issue as images above. Should move to object storage.
- **Campaign generation blocks for 20-40s** — a full-screen loading overlay prevents navigation during this time. A better UX would be background processing with polling or websockets.
- **No rate limiting** — the API has no request throttling. Add `express-rate-limit` before exposing to the public.
- **Image generation is per-post** — bulk image generation for all posts in a campaign in one click is not yet implemented.
