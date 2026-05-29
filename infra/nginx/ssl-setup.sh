#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Must be run as root"
  exit 1
fi

if ! command -v certbot &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi

read -rp "API domain (e.g. api.example.com): " API_DOMAIN
read -rp "Admin domain (e.g. admin.example.com): " ADMIN_DOMAIN

certbot --nginx -d "$API_DOMAIN" -d "$ADMIN_DOMAIN" --non-interactive --agree-tos -m "admin@$API_DOMAIN"

sed -i "s/api.YOURDOMAIN.COM/$API_DOMAIN/g" /etc/nginx/sites-available/email-relay
sed -i "s/admin.YOURDOMAIN.COM/$ADMIN_DOMAIN/g" /etc/nginx/sites-available/email-relay

nginx -t && systemctl reload nginx

echo "SSL certificates obtained and Nginx configured for:"
echo "  API:   https://$API_DOMAIN"
echo "  Admin: https://$ADMIN_DOMAIN"
