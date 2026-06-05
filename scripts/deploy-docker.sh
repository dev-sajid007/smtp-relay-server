#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/email-relay"
REPO_URL="${REPO_URL:-https://github.com/dev-sajid007/smtp-realay-server.git}"
BRANCH="${BRANCH:-main}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then err "This script must be run as root (sudo)"; fi
}

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker already installed"
  else
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | bash
  fi

  if command -v docker compose &>/dev/null; then
    log "Docker Compose already installed"
  else
    log "Installing Docker Compose..."
    apt-get install -y -qq docker-compose-plugin
  fi
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
  ufw --force enable
  log "Firewall enabled"
}

deploy_code() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Updating repository..."
    cd "$APP_DIR" && git pull origin "$BRANCH"
  else
    log "Cloning repository..."
    mkdir -p "$APP_DIR"
    git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
  fi
}

setup_env() {
  if [[ ! -f "$APP_DIR/.env" ]]; then
    if [[ -f "$APP_DIR/infra/docker/.env.prod.example" ]]; then
      cp "$APP_DIR/infra/docker/.env.prod.example" "$APP_DIR/.env"
      warn "Edit $APP_DIR/.env and set your DATABASE_URL and JWT_SECRET"
    fi
  else
    warn "Keeping existing .env file"
  fi
}

start_services() {
  log "Starting Docker services..."
  cd "$APP_DIR"
  docker compose -f infra/docker/docker-compose.prod.yml --env-file .env up -d --build
  log "All services started"
}

print_summary() {
  local ip
  ip=$(hostname -I | awk '{print $1}')

  echo ""
  echo "┌──────────────────────────────────────────────────┐"
  echo "│     Email Relay — Docker Production Deploy Done  │"
  echo "├──────────────────────────────────────────────────┤"
  echo "│                                                  │"
  echo "│  Services:                                       │"
  echo "│    docker ps --filter name=email-relay           │"
  echo "│                                                  │"
  echo "│  SMTP:    port 25                                │"
  echo "│  API:     http://$ip:3000                        │"
  echo "│  Admin:   http://$ip:80                          │"
  echo "│                                                  │"
  echo "│  Config: $APP_DIR/.env                   │"
  echo "│  Logs:   docker logs email-relay-api -f          │"
  echo "│                                                  │"
  echo "│  Post-deploy checklist:                          │"
  echo "│  □ Set DATABASE_URL in .env                      │"
  echo "│  □ Set JWT_SECRET in .env                        │"
  echo "│  □ Set up domains: api / admin                   │"
  echo "│  □ Install SSL: certbot --nginx ...              │"
  echo "│  □ Set up DNS: SPF, DKIM, DMARC, PTR             │"
  echo "│  □ Test deliverability at mail-tester.com        │"
  echo "└──────────────────────────────────────────────────┘"
}

main() {
  echo ""
  echo "  Email Relay — Docker Production Deployment"
  echo "  ───────────────────────────────────────────"
  require_root

  install_docker
  setup_firewall
  deploy_code
  setup_env
  start_services
  print_summary
}

main "$@"
