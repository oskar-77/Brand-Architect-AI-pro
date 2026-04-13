# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: AI Brand & Marketing OS

A full-stack SaaS platform that transforms raw business input into a complete brand identity, visual palette, marketing strategy, 7-day campaign plan, and editable social media posts.

### Frontend (artifacts/brand-os)
- React + Vite + Tailwind CSS + wouter routing
- Pages: Dashboard, Brand Wizard (4-step), Brand Kit, Campaign List, Campaign Workspace, Brand Edit
- All API calls via React Query hooks from `@workspace/api-client-react`

### Backend (artifacts/api-server)
- Express 5 REST API
- Routes: /brands, /campaigns, /posts, /dashboard/summary
- AI orchestration layer in src/lib/ai.ts (Brand Intelligence Engine, Visual Identity Engine, Campaign Generation Engine)

### Database (lib/db)
- PostgreSQL via Drizzle ORM
- Tables: brands, campaigns, posts

### API Spec (lib/api-spec)
- OpenAPI 3.1 spec in openapi.yaml
- Generates React Query hooks (api-client-react) and Zod schemas (api-zod)

### AI Architecture
- Brand Intelligence Engine: generates personality, positioning, tone of voice, audience segments
- Visual Identity Engine: extracts color palettes, defines visual styles (tech/luxury/bold/minimal)
- Campaign Generation Engine: 7-day structured marketing plan + social posts with image prompts
- All AI outputs are structured JSON — no unstructured text
- Designed for extensibility (analytics, scheduling, competitor intelligence can be added)
