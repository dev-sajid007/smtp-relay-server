FROM node:26-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/database ./packages/database
COPY apps/smtp-server ./apps/smtp-server

RUN pnpm install --frozen-lockfile --filter @email-relay/database --filter @email-relay/smtp-server
RUN pnpm --filter @email-relay/database db:generate
RUN pnpm --filter @email-relay/smtp-server build

FROM node:26-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/smtp-server/dist ./apps/smtp-server/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/apps/smtp-server/package.json ./apps/smtp-server/package.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 2525

CMD ["node", "apps/smtp-server/dist/main.js"]
