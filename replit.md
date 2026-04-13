# AI Brand & Marketing OS — Agent Knowledge Base

This file is the authoritative technical reference for the project. It is always loaded into the AI agent's context. Keep it updated whenever architecture, schema, or major features change.

---

## What This App Does

A web application where users create brand identities and full social media campaigns using AI. The core loop:

1. User fills out a brand form (company name, description, industry, optional logo)
2. AI (OpenAI `gpt-5-nano`) generates a complete brand kit: personality, positioning, color palette, tone of voice, visual style rules
3. User launches a campaign; AI generates 7-14 social posts (hook, caption, CTA, hashtags, image prompt)
4. User reviews, edits, and regenerates individual posts; can generate an AI image per post

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
├── pnpm-workspace.yaml
└── README.md               Full project documentation for humans and agents
```

---

## Key Files (Memorize These)

| File | Role |
|---|---|
| `artifacts/api-server/src/app.ts` | Express middleware chain (compression, CORS, logging, error handler) |
| `artifacts/api-server/src/index.ts` | HTTP server entry; sets keepAliveTimeout |
| `artifacts/api-server/src/routes/brands.ts` | All brand endpoints + AI generation |
| `artifacts/api-server/src/routes/campaigns.ts` | GET /campaigns/:id |
| `artifacts/api-server/src/routes/posts.ts` | Edit, regenerate, generate image |
| `artifacts/api-server/src/routes/dashboard.ts` | Parallel DB queries for dashboard |
| `artifacts/api-server/src/lib/ai.ts` | generateBrandKit() + generateCampaign() |
| `artifacts/api-server/src/lib/asyncHandler.ts` | Wraps async routes, sends errors to global handler |
| `lib/db/src/index.ts` | pg Pool + Drizzle client (max 10 connections) |
| `lib/db/src/schema/brands.ts` | brands table |
| `lib/db/src/schema/campaigns.ts` | campaigns table |
| `lib/db/src/schema/posts.ts` | posts table |
| `artifacts/brand-os/src/App.tsx` | Router + QueryClient + lazy page imports |
| `artifacts/brand-os/src/components/Layout.tsx` | Sidebar + data prefetch on mount |
| `artifacts/brand-os/src/pages/BrandWizard.tsx` | 4-step brand creation |
| `artifacts/brand-os/src/pages/BrandKit.tsx` | Brand display + campaign launch |
| `artifacts/brand-os/src/pages/CampaignWorkspace.tsx` | Post edit/regen/image |
| `artifacts/brand-os/src/lib/colorExtractor.ts` | Canvas-based logo color extraction |

---

## Environment Variables

| Variable | Who Sets It | Purpose |
|---|---|---|
| `DATABASE_URL` | Replit PostgreSQL integration | DB connection string |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit OpenAI integration | Proxy base URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit OpenAI integration | Proxy API key |
| `PORT` | Replit artifact system | Port for API server (8080) |
| `BASE_PATH` | Replit artifact system | Vite base path for frontend |

Do NOT hardcode these. Always read from `process.env`.

---

## Database Schema (Drizzle ORM)

### brands
- `id` serial PK
- `company_name` text NOT NULL
- `company_description` text NOT NULL
- `industry` text NOT NULL
- `website_url` text nullable
- `logo_url` text nullable (base64 JPEG, max 800px)
- `status` text NOT NULL default `draft` → `kit_ready` → `active`
- `brand_kit` jsonb nullable (see structure below)
- `created_at`, `updated_at` timestamptz

**brand_kit JSON:**
```json
{
  "personality": "string",
  "positioning": "string",
  "toneOfVoice": "string",
  "audienceSegments": ["string"],
  "visualStyle": "tech|luxury|bold|minimal",
  "colorPalette": { "primary": "#HEX", "secondary": "#HEX", "accent": "#HEX", "background": "#HEX", "text": "#HEX" },
  "visualStyleRules": "string"
}
```

### campaigns
- `id` serial PK
- `brand_id` integer FK → brands.id CASCADE DELETE
- `title` text
- `strategy` text
- `days` jsonb (array of `{ day, objective, postConcept, marketingAngle, cta }`)
- `created_at`, `updated_at` timestamptz

### posts
- `id` serial PK
- `campaign_id` integer FK → campaigns.id CASCADE DELETE
- `day` integer (1-indexed)
- `caption` text
- `hook` text
- `cta` text
- `hashtags` text[] (array)
- `image_prompt` text (DALL-E prompt)
- `image_url` text nullable (base64 PNG, set on demand)
- `platform` text default `instagram`
- `created_at`, `updated_at` timestamptz

**Schema migration:** `cd lib/db && pnpm run push`

---

## API Routes Quick Reference

```
GET    /api/health
GET    /api/dashboard/summary
GET    /api/brands
POST   /api/brands                        { companyName, companyDescription, industry, websiteUrl?, logoUrl?, brandColors? }
GET    /api/brands/:id
PATCH  /api/brands/:id                    partial brand fields
DELETE /api/brands/:id
POST   /api/brands/:id/generate-kit       { brandColors?: string[] }
POST   /api/brands/:id/generate-campaign  { brief?: string, postCount?: number (1-14) }
GET    /api/brands/:id/campaigns
GET    /api/brands/:id/stats
GET    /api/campaigns/:id
GET    /api/posts/:id
PATCH  /api/posts/:id                     { caption?, hook?, cta?, hashtags?, imagePrompt?, platform? }
POST   /api/posts/:id/regenerate
POST   /api/posts/:id/generate-image
```

All routes wrapped with `asyncHandler()`. Errors go to global middleware → `{ error: "message" }`.

---

## AI Functions

### generateBrandKit(companyName, companyDescription, industry, brandColors?)
- Model: `gpt-5-nano`, max_tokens: 8192
- Returns structured brand kit JSON
- If brandColors provided → uses them as palette foundation
- On JSON parse failure → falls back to buildFallbackKit()

### generateCampaign(companyName, companyDescription, industry, brandKit, brief?, postCount=7)
- Model: `gpt-5-nano`, max_tokens: 8192
- postCount clamped to 1-14
- Returns `{ title, strategy, days[], posts[] }`
- On JSON parse failure → falls back to buildFallbackCampaign()

### Image generation (posts route)
- Model: `gpt-image-1`, size: 1024x1024
- Called via `generateImageBuffer(imagePrompt, "1024x1024")` from integrations package
- Saves as base64 PNG data URL in `posts.image_url`

---

## Frontend Patterns

### Lazy loading
All pages use `React.lazy()` + `<Suspense>`. Add new pages the same way in `App.tsx`.

### Query hooks
Import from `@workspace/api-client-react`. Generated automatically from OpenAPI spec.
Do NOT write raw `fetch()` calls in pages — always use the generated hooks.

### Cache settings (QueryClient)
- `staleTime: 5 minutes` — data is considered fresh for 5 min
- `gcTime: 15 minutes` — unused data kept in memory for 15 min
- `refetchOnWindowFocus: false` — no auto-refetch on tab focus
- After mutations, invalidate relevant query keys manually

### Data prefetch on Layout mount
`Layout.tsx` prefetches `/api/dashboard/summary` and `/api/brands` on mount using raw fetch + `queryClient.setQueryData()`. This makes Dashboard feel instant.

### Logo color extraction
`lib/colorExtractor.ts` → `extractColorsFromDataUrl(dataUrl, n)` → returns `string[]` of hex colors.
Uses HTML5 Canvas to sample pixels and find dominant colors via k-means-like clustering.

---

## Frontend Routes

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/brands/new` | BrandWizard (4 steps) |
| `/brands/:id` | BrandKit |
| `/brands/:id/edit` | BrandEdit |
| `/brands/:id/campaigns` | CampaignList |
| `/campaigns/:id` | CampaignWorkspace |

---

## Development Workflows (Replit)

| Workflow | Command | Port |
|---|---|---|
| API Server | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| Frontend | `pnpm --filter @workspace/brand-os run dev` | dynamic ($PORT) |

Both workflows must be running. The frontend proxies API calls through the Replit preview proxy.

---

## How to Add a New Feature

### New API endpoint:
1. Add Zod schemas to `lib/api-zod/src/`
2. Add route handler in `artifacts/api-server/src/routes/` using `asyncHandler()`
3. Mount in `artifacts/api-server/src/routes/index.ts`
4. Update `lib/api-spec/` OpenAPI spec
5. Run `pnpm --filter @workspace/api-client-react run codegen`

### New database column:
1. Edit schema in `lib/db/src/schema/`
2. Run `cd lib/db && pnpm run push`
3. Update Zod schemas + routes

### New frontend page:
1. Create component in `artifacts/brand-os/src/pages/`
2. Add lazy import in `App.tsx`
3. Add `<Route>` in the `<Switch>`

---

## Known Issues / Tech Debt

- Logo and generated images stored as base64 in PostgreSQL — fine for MVP, needs object storage (S3/R2) at scale
- No authentication — all data is public; needs Clerk or Replit Auth for multi-tenant
- No rate limiting on API — add `express-rate-limit` before public exposure
- Campaign generation takes 20-40s — currently blocks with a loading overlay; should be background job with polling
- Bulk image generation (all posts at once) not implemented yet
