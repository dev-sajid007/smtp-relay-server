FROM node:26-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/database ./packages/database
COPY apps/worker ./apps/worker

RUN pnpm install --frozen-lockfile --filter @email-relay/database --filter @email-relay/worker
RUN pnpm --filter @email-relay/database db:generate
RUN pnpm --filter @email-relay/worker build

FROM node:26-alpine
WORKDIR /app

COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/package.json ./package.json

CMD ["node", "apps/worker/dist/main.js"]
