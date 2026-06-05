FROM node:26-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/database ./packages/database
COPY apps/admin-panel ./apps/admin-panel

RUN pnpm install --frozen-lockfile --filter @email-relay/database --filter @email-relay/admin-panel
RUN pnpm --filter @email-relay/admin-panel build

FROM nginx:alpine
COPY --from=builder /app/apps/admin-panel/dist /usr/share/nginx/html
COPY infra/docker/admin.nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
