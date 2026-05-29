#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Email Relay — Ubuntu VPS Deployment Script
# ─────────────────────────────────────────────

APP_DIR="/opt/email-relay"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
NODE_VERSION="26"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
err()    { echo -e "${RED}[✗]${NC} $1"; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (sudo)"
  fi
}

install_system_deps() {
  log "Updating system packages..."
  apt-get update -qq

  log "Installing system dependencies..."
  apt-get install -y -qq \
    curl wget git gnupg ca-certificates \
    ufw unattended-upgrades apt-listchanges \
    postfix opendkim opendkim-tools \
    redis-server 2>&1 | tail -1
}

setup_firewall() {
  log "Configuring firewall..."
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 25/tcp    # SMTP
  ufw allow 80/tcp    # HTTP (for certbot)
  ufw allow 443/tcp   # HTTPS
  ufw allow 3000/tcp  # API
  ufw --force enable
  log "Firewall enabled"
}

install_nodejs() {
  if command -v node &>/dev/null && [[ "$(node -v)" == v${NODE_VERSION}* ]]; then
    log "Node.js v${NODE_VERSION} already installed"
    return
  fi

  log "Installing Node.js v${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs

  log "Installing pnpm..."
  corepack enable
  corepack prepare pnpm@latest --activate
}

setup_app_directory() {
  if [[ -d "$APP_DIR" ]]; then
    warn "Application directory already exists at $APP_DIR"
    read -rp "Overwrite? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      err "Aborted by user"
    fi
    rm -rf "$APP_DIR"
  fi

  mkdir -p "$APP_DIR"
}

deploy_code() {
  if [[ -n "$REPO_URL" ]]; then
    log "Cloning repository from $REPO_URL..."
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  else
    warn "No REPO_URL set. Copying local files..."
    rsync -av --exclude='node_modules' --exclude='.env' \
      "$(dirname "$0")/.." "$APP_DIR"
  fi
}

setup_env() {
  if [[ -f "$APP_DIR/.env" ]]; then
    warn ".env file already exists, keeping existing"
    return
  fi

  log "Creating .env file..."
  cat > "$APP_DIR/.env" << 'ENVEOF'
# Database (Prisma Data Platform / PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/postgres?sslmode=require"

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# JWT
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_SECRET

# SMTP Server
SMTP_HOST=0.0.0.0
SMTP_PORT=2525

# Postfix (local)
POSTFIX_HOST=127.0.0.1
POSTFIX_PORT=25

# API
PORT=3000
HOST=0.0.0.0
ENVEOF

  warn "Please edit $APP_DIR/.env to set your DATABASE_URL and JWT_SECRET"
}

install_deps_build() {
  log "Installing dependencies..."
  cd "$APP_DIR"
  pnpm install --frozen-lockfile 2>&1 | tail -1

  log "Building all packages..."
  pnpm build 2>&1 | tail -1
}

setup_database() {
  log "Pushing database schema..."
  cd "$APP_DIR"
  pnpm db:push 2>&1 | tail -1

  log "Seeding database..."
  pnpm db:seed 2>&1 | tail -1
}

setup_postfix() {
  log "Configuring Postfix..."

  # Stop system postfix if running on port 25 for docker
  systemctl stop postfix 2>/dev/null || true
  systemctl disable postfix 2>/dev/null || true

  # Basic Postfix config for relaying
  postconf -e "myhostname = $(hostname -f)"
  postconf -e "mydomain = $(hostname -d || echo 'localhost')"
  postconf -e "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"
  postconf -e "home_mailbox = Maildir/"
  postconf -e "smtpd_banner = \$myhostname ESMTP"

  systemctl enable postfix
  systemctl start postfix

  log "Postfix configured"
}

setup_opendkim() {
  log "Configuring OpenDKIM..."
  mkdir -p /etc/opendkim/keys

  cat > /etc/opendkim.conf << 'DKIMCONF'
Syslog          yes
UMask           007
Socket          inet:8891@localhost
PidFile         /var/run/opendkim/opendkim.pid
TrustAnchorFile /usr/share/dns/root.key
UserID          opendkim:opendkim
AutoRestart     yes
OversignHeaders From
DKIMCONF

  mkdir -p /etc/systemd/system/opendkim.service.d
  cat > /etc/systemd/system/opendkim.service.d/override.conf << 'OVERRIDE'
[Service]
ExecStart=
ExecStart=/usr/sbin/opendkim -x /etc/opendkim.conf
OVERRIDE

  systemctl daemon-reload
  systemctl enable opendkim
  systemctl restart opendkim
  log "OpenDKIM configured"
}

create_systemd_service() {
  local name="$1"
  local exec="$2"

  log "Creating systemd service: $name..."

  cat > "/etc/systemd/system/email-relay-$name.service" << UNIT
[Unit]
Description=Email Relay - $name
After=network.target redis-server.service postfix.service
Requires=redis-server.service

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$exec
Restart=always
RestartSec=3
User=root
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable "email-relay-$name"
  systemctl restart "email-relay-$name"
  log "$name service started"
}

configure_logrotate() {
  log "Setting up logrotate..."

  cat > /etc/logrotate.d/email-relay << 'LOG'
/opt/email-relay/logs/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
LOG
}

print_summary() {
  echo ""
  echo "┌─────────────────────────────────────────────┐"
  echo "│         Email Relay — Deployment Done       │"
  echo "├─────────────────────────────────────────────┤"
  echo "│  API:     http://$(hostname -I | awk '{print $1}'):3000          │"
  echo "│  SMTP:    port 25                            │"
  echo "│  Admin:   http://$(hostname -I | awk '{print $1}'):5173          │"
  echo "│                                             │"
  echo "│  Edit:   $APP_DIR/.env              │"
  echo "│  Logs:   journalctl -fu email-relay-api     │"
  echo "│  Status: systemctl status email-relay-*     │"
  echo "│                                             │"
  echo "│  Post-deploy steps:                         │"
  echo "│  1. Edit $APP_DIR/.env with your DB URL     │"
  echo "│  2. Set JWT_SECRET to a random string       │"
  echo "│  3. Restart: systemctl restart email-relay-*│"
  echo "└─────────────────────────────────────────────┘"
}

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

main() {
  echo ""
  echo "  Email Relay — Ubuntu VPS Deployment"
  echo "  ───────────────────────────────────"
  echo ""

  require_root

  read -rp "Set a JWT secret (leave blank to generate): " jwt_secret
  JWT_SECRET="${jwt_secret:-$(openssl rand -hex 32)}"
  export JWT_SECRET

  install_system_deps
  setup_firewall
  install_nodejs
  setup_app_directory
  deploy_code
  setup_env
  install_deps_build
  setup_database
  setup_postfix
  setup_opendkim
  configure_logrotate

  create_systemd_service "api"    "$APP_DIR/apps/api/scripts/start.sh"
  create_systemd_service "smtp-server" "$APP_DIR/apps/smtp-server/scripts/start.sh"
  create_systemd_service "worker" "$APP_DIR/apps/worker/scripts/start.sh"

  print_summary
}

main "$@"
