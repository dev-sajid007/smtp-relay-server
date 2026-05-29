#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Email Relay — Ubuntu VPS Production Deploy
# ─────────────────────────────────────────────

APP_DIR="/opt/email-relay"
REPO_URL="${REPO_URL:-https://github.com/dev-sajid007/smtp-realay-server.git}"
BRANCH="${BRANCH:-main}"
NODE_VERSION="26"
API_DOMAIN="${API_DOMAIN:-}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then err "This script must be run as root (sudo)"; fi
}

install_system_deps() {
  log "Updating system packages..."
  apt-get update -qq && apt-get upgrade -y -qq

  log "Installing system dependencies..."
  apt-get install -y -qq \
    curl wget git gnupg ca-certificates \
    ufw unattended-upgrades apt-listchanges \
    postfix opendkim opendkim-tools \
    redis-server nginx fail2ban \
    htop net-tools

  log "Configuring unattended-upgrades..."
  cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTO'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTO
}

setup_firewall() {
  log "Configuring firewall..."
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 25/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 3000/tcp
  ufw --force enable
  log "Firewall enabled"
}

install_nodejs() {
  if command -v node &>/dev/null && [[ "$(node -v)" == v${NODE_VERSION}* ]]; then
    log "Node.js v${NODE_VERSION} already installed"; return
  fi
  log "Installing Node.js v${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
  corepack enable
  corepack prepare pnpm@latest --activate
}

setup_app_directory() {
  if [[ -d "$APP_DIR" ]]; then
    warn "Application directory exists at $APP_DIR, updating..."
    cd "$APP_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
    return
  fi
  mkdir -p "$APP_DIR"
}

deploy_code() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Repository already cloned, pulling latest..."
    cd "$APP_DIR" && git pull origin "$BRANCH"
  else
    log "Cloning repository..."
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  fi
}

setup_env() {
  if [[ ! -f "$APP_DIR/.env" ]]; then
    JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 64)}"

    cat > "$APP_DIR/.env" << ENVEOF
# Database (cloud PostgreSQL via Prisma)
DATABASE_URL="postgresql://user:password@host:5432/postgres?sslmode=require"

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# JWT
JWT_SECRET=$JWT_SECRET

# SMTP Server
SMTP_HOST=0.0.0.0
SMTP_PORT=2525
SMTP_RATE_LIMIT_MAX=100
SMTP_RATE_LIMIT_WINDOW=3600

# Postfix
POSTFIX_HOST=127.0.0.1
POSTFIX_PORT=25

# Worker
WORKER_CONCURRENCY=5
WORKER_RATE_LIMIT=10

# API
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
ENVEOF

    warn "Edit $APP_DIR/.env and set your DATABASE_URL"
  else
    warn "Keeping existing .env file"
  fi
}

install_deps_build() {
  log "Installing dependencies..."
  cd "$APP_DIR"
  pnpm install --frozen-lockfile 2>&1 | tail -1
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
  systemctl stop postfix 2>/dev/null || true

  postconf -e "myhostname = $(hostname -f)"
  postconf -e "mydomain = $(hostname -d || echo 'localhost')"
  postconf -e "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"
  postconf -e "smtpd_banner = \$myhostname ESMTP"
  postconf -e "message_size_limit = 52428800"
  postconf -e "smtp_use_tls = yes"

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
Mode            sv
SubDomains      yes
Canonicalization relaxed/simple
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

setup_nginx() {
  log "Configuring Nginx..."

  cp "$APP_DIR/infra/nginx/email-relay.conf" /etc/nginx/sites-available/email-relay

  if [[ -n "$API_DOMAIN" && -n "$ADMIN_DOMAIN" ]]; then
    sed -i "s/api.YOURDOMAIN.COM/$API_DOMAIN/g" /etc/nginx/sites-available/email-relay
    sed -i "s/admin.YOURDOMAIN.COM/$ADMIN_DOMAIN/g" /etc/nginx/sites-available/email-relay
  fi

  if [[ ! -f /etc/nginx/sites-enabled/email-relay ]]; then
    ln -s /etc/nginx/sites-available/email-relay /etc/nginx/sites-enabled/
  fi

  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  log "Nginx configured"
}

setup_ssl() {
  if [[ -z "$API_DOMAIN" || -z "$ADMIN_DOMAIN" ]]; then
    warn "Skipping SSL: API_DOMAIN and ADMIN_DOMAIN not set"
    warn "Run: certbot --nginx -d your-api-domain -d your-admin-domain"
    return
  fi

  if command -v certbot &>/dev/null; then
    log "Obtaining SSL certificates..."
    certbot --nginx -d "$API_DOMAIN" -d "$ADMIN_DOMAIN" \
      --non-interactive --agree-tos -m "admin@$API_DOMAIN"
    log "SSL certificates obtained"

    systemctl enable certbot.timer
    systemctl start certbot.timer
    log "Certbot auto-renewal enabled"
  fi
}

setup_fail2ban() {
  log "Configuring Fail2ban..."
  mkdir -p /etc/fail2ban/filter.d

  cp -n "$APP_DIR/infra/fail2ban/filter.d/smtp-relay.conf" /etc/fail2ban/filter.d/smtp-relay.conf 2>/dev/null || true
  cp -n "$APP_DIR/infra/fail2ban/jail.local" /etc/fail2ban/jail.local 2>/dev/null || true

  systemctl enable fail2ban
  systemctl restart fail2ban
  log "Fail2ban configured"
}

setup_backup_cron() {
  log "Setting up database backup cron..."
  cp "$APP_DIR/scripts/backup.sh" /etc/cron.daily/email-relay-backup
  chmod +x /etc/cron.daily/email-relay-backup
  log "Daily backup configured (retention: 30 days)"
}

create_systemd_service() {
  local name="$1"
  local exec="$2"
  local after="$3"

  log "Creating systemd service: $name..."

  cat > "/etc/systemd/system/email-relay-$name.service" << UNIT
[Unit]
Description=Email Relay - $name
After=network.target $after
Requires=$after

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$exec
Restart=always
RestartSec=5
User=root
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env
StandardOutput=journal
StandardError=journal

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

/var/log/nginx/email-relay-*.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  postrotate
    systemctl reload nginx > /dev/null 2>&1 || true
  endscript
}
LOG
}

print_summary() {
  local ip
  ip=$(hostname -I | awk '{print $1}')
  echo ""
  echo "┌──────────────────────────────────────────────────┐"
  echo "│         Email Relay — Production Deploy Done     │"
  echo "├──────────────────────────────────────────────────┤"
  echo "│                                                  │"
  if [[ -n "$API_DOMAIN" ]]; then
    echo "│  API:     https://$API_DOMAIN                    │"
    echo "│  Admin:   https://$ADMIN_DOMAIN                   │"
  else
    echo "│  API:     http://$ip:3000                        │"
  fi
  echo "│  SMTP:    port 25                                  │"
  echo "│                                                  │"
  echo "│  Config: $APP_DIR/.env                   │"
  echo "│  Logs:   journalctl -fu email-relay-api           │"
  echo "│                                                  │"
  echo "│  Post-deploy checklist:                           │"
  echo "│  □ Set DATABASE_URL in .env                       │"
  echo "│  □ Set up DNS: SPF, DKIM, DMARC, PTR              │"
  echo "│  □ Test deliverability at mail-tester.com         │"
  echo "│  □ Run SSL setup: certbot --nginx ...             │"
  echo "└──────────────────────────────────────────────────┘"
}

main() {
  echo ""
  echo "  Email Relay — Ubuntu VPS Production Deployment"
  echo "  ───────────────────────────────────────────────"
  require_root

  read -rp "JWT secret (blank = generate): " input_secret
  JWT_SECRET="${input_secret:-$(openssl rand -hex 64)}"
  export JWT_SECRET

  read -rp "API domain (e.g. api.example.com, blank = skip SSL): " API_DOMAIN
  read -rp "Admin domain (e.g. admin.example.com): " ADMIN_DOMAIN

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
  setup_nginx
  setup_ssl
  setup_fail2ban
  setup_backup_cron
  configure_logrotate

  create_systemd_service "api"    "$APP_DIR/apps/api/scripts/start.sh"    "redis-server.service postfix.service"
  create_systemd_service "smtp-server" "$APP_DIR/apps/smtp-server/scripts/start.sh" "redis-server.service"
  create_systemd_service "worker" "$APP_DIR/apps/worker/scripts/start.sh" "redis-server.service postfix.service"

  print_summary
}

main "$@"
