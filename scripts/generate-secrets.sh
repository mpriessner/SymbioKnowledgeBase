#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SymbioKnowledgeBase — Generate Production Secrets
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Generates strong random values for all production secrets.
# Copy the output to your .env file.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "============================================="
echo "  SymbioKnowledgeBase — Secret Generator"
echo "============================================="
echo ""
echo "Copy these values to your .env file:"
echo ""

# Generate NEXTAUTH_SECRET (base64, 32 bytes = 44 characters)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=\"${NEXTAUTH_SECRET}\""
echo ""

# Generate DB_PASSWORD (alphanumeric, 32 characters)
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
echo "DB_PASSWORD=\"${DB_PASSWORD}\""
echo ""

echo "============================================="
echo ""
echo "IMPORTANT: After updating .env, restart the services:"
echo "  docker compose -f docker-compose.prod.yml down"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "WARNING: Changing DB_PASSWORD requires updating the"
echo "         PostgreSQL user password manually if the"
echo "         database already exists."
