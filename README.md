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
| Mail | Postfix, OpenDKIM |
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
│   └── docker/           # Docker Compose for Redis, Postfix, OpenDKIM
└── scripts/
    └── deploy.sh         # Ubuntu VPS deployment script
```

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL (cloud — Prisma Data Platform, Supabase, Neon, etc.)
- Redis
- Postfix (for delivery)

### Local Development

```bash
# Install dependencies
pnpm install

# Push schema to database
pnpm db:push

# Seed admin user (password: admin123)
pnpm db:seed

# Start services (each in a separate terminal)
pnpm --filter @email-relay/api dev
pnpm --filter @email-relay/smtp-server dev
pnpm --filter @email-relay/worker dev
pnpm --filter @email-relay/admin-panel dev
```

### Docker (local services)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
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

On a fresh Ubuntu 24.04 VPS:

```bash
sudo bash scripts/deploy.sh
```

Or with a git remote:

```bash
REPO_URL="https://github.com/dev-sajid007/smtp-realay-server.git" sudo bash scripts/deploy.sh
```

The script installs all dependencies, configures Postfix + OpenDKIM, sets up systemd services, and configures the firewall.

### VPS Requirements

- Ubuntu 24.04
- 2 vCPU / 4 GB RAM / 50 GB SSD
- Port 25 open
- PTR record configured

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `JWT_SECRET` | JWT signing secret |
| `SMTP_HOST` | SMTP server bind address |
| `SMTP_PORT` | SMTP server port |
| `POSTFIX_HOST` | Postfix host |
| `POSTFIX_PORT` | Postfix port |
| `PORT` | API server port |
| `HOST` | API bind address |

## Database Schema

- `admins` — admin users
- `domains` — sending domains with DKIM keys
- `smtp_credentials` — SMTP auth credentials
- `emails` — email records with status
- `email_events` — event log per email
