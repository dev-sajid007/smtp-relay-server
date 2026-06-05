# Email Relay Server

A self-hosted SMTP relay service. Accepts emails via SMTP with authentication, queues them with BullMQ, DKIM-signs them, and delivers through Postfix.

## Architecture

```
SMTP Client → SMTP Server → Database → BullMQ Queue → Worker → DKIM Sign → Postfix → Recipient
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, NestJS, Fastify |
| ORM | Prisma |
| Database | PostgreSQL (cloud) |
| Queue | Redis, BullMQ |
| Mail | Postfix |
| Frontend | React, Vite, Tailwind CSS |

## Project Structure

```
├── apps/
│   ├── api/              # REST API (NestJS + Fastify)
│   ├── smtp-server/      # SMTP inbound server
│   ├── worker/           # BullMQ consumer + DKIM sign + delivery
│   └── admin-panel/      # React admin dashboard
├── packages/
│   └── database/         # Prisma schema + shared client
├── infra/
│   └── docker/           # Docker Compose files + Dockerfiles
│       ├── docker-compose.yml       # Local infra (Redis, Postfix)
│       ├── docker-compose.prod.yml  # Full production stack (7 services)
│       ├── api.Dockerfile
│       ├── worker.Dockerfile
│       ├── smtp.Dockerfile
│       ├── admin.Dockerfile
│       └── nginx/                   # Nginx reverse proxy config
├── scripts/
│   ├── deploy.sh         # Ubuntu VPS bare-metal deployment
│   └── deploy-docker.sh  # Ubuntu VPS Docker deployment
```

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL (cloud — Prisma Data Platform, Supabase, Neon, etc.)
- Docker (for local Redis & Postfix)

### Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Redis + Postfix)
docker compose -f infra/docker/docker-compose.yml up -d

# 3. Push schema and seed
pnpm db:push
pnpm db:seed    # admin: admin@emailrelay.local / admin123

# 4. Start apps (each in a separate terminal)
pnpm --filter @email-relay/api dev
pnpm --filter @email-relay/smtp-server dev
pnpm --filter @email-relay/worker dev
pnpm --filter @email-relay/admin-panel dev
```

### Docker (local services only)

Starts Redis (port 6379) and Postfix (port 25) for local development:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### Docker (full production stack)

Builds and runs all 7 services (Redis, Postfix, API, Worker, SMTP Server, Admin Panel, Nginx):

```bash
cp infra/docker/.env.prod.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env up -d --build
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Admin login |
| GET | `/health` | — | Health check |
| GET | `/domains` | JWT | List domains |
| POST | `/domains` | JWT | Add domain |
| DELETE | `/domains/:id` | JWT | Delete domain |
| POST | `/domains/:id/dkim/generate`| JWT | Generate DKIM keys |
| GET | `/domains/:id/dns` | JWT | Get DNS records |
| GET | `/smtp-credentials` | JWT | List SMTP credentials |
| POST | `/smtp-credentials/domain/:domainId` | JWT | Create credential |
| POST | `/smtp-credentials/:id/rotate` | JWT | Rotate password |
| POST | `/smtp-credentials/:id/toggle` | JWT | Enable/disable |
| DELETE | `/smtp-credentials/:id` | JWT | Delete credential |
| GET | `/emails` | JWT | List emails |
| GET | `/emails/:id` | JWT | Get email details |
| GET | `/logs` | JWT | List email events |
| GET | `/queue/status` | JWT | Queue stats |
| GET | `/dkim/domain/:id` | JWT | DKIM status |

## Deployment

### Option 1: Docker (recommended)

On a fresh Ubuntu 24.04 VPS:

```bash
sudo bash scripts/deploy-docker.sh
```

Or with a custom repo:

```bash
REPO_URL="https://github.com/dev-sajid007/smtp-realay-server.git" sudo bash scripts/deploy-docker.sh
```

The script installs Docker, clones the repo, builds all containers, and starts the full stack.

Manual steps after deploy:

```bash
# Edit environment variables
nano /opt/email-relay/.env

# Restart with new config
cd /opt/email-relay
docker compose -f infra/docker/docker-compose.prod.yml --env-file .env up -d --build
```

### Option 2: Bare-metal

On a fresh Ubuntu 24.04 VPS:

```bash
sudo bash scripts/deploy.sh
```

The script installs Node.js, Redis, Postfix, OpenDKIM, configures systemd services and firewall.

### VPS Requirements

- Ubuntu 24.04
- 2 vCPU / 4 GB RAM / 50 GB SSD
- Port 25 open
- PTR record configured

## Environment Variables

### Core

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | JWT signing secret |
| `NODE_ENV` | `production` | Environment mode |
| `LOG_LEVEL` | `info` | Logging level |

### API

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port |
| `HOST` | `0.0.0.0` | API bind address |

### SMTP Server

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | `0.0.0.0` | SMTP bind address |
| `SMTP_PORT` | `2525` | SMTP server port |
| `SMTP_RATE_LIMIT_MAX` | `100` | Max emails per window |
| `SMTP_RATE_LIMIT_WINDOW` | `3600` | Rate limit window (seconds) |

### Queue (BullMQ)

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

### Delivery (Postfix)

| Variable | Default | Description |
|---|---|---|
| `POSTFIX_HOST` | `127.0.0.1` | Postfix host |
| `POSTFIX_PORT` | `25` | Postfix port |
| `POSTFIX_HOSTNAME` | `mail.example.com` | Postfix myhostname |

### Worker

| Variable | Default | Description |
|---|---|---|
| `WORKER_CONCURRENCY` | `5` | Concurrent jobs |
| `WORKER_RATE_LIMIT` | `10` | Jobs per second |

## Database Schema

- `admins` — admin users
- `domains` — sending domains with DKIM keys
- `smtp_credentials` — SMTP auth credentials
- `emails` — email records with status
- `email_events` — event log per email
