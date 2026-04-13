FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
  openssl \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json ./lib/integrations-openai-ai-server/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/brand-os/package.json ./artifacts/brand-os/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/brand-os run build
RUN pnpm --filter @workspace/api-server run build

RUN mkdir -p /app/storage/logos /app/storage/images

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV STORAGE_DIR=/app/storage

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
