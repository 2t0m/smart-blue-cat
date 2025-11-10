#!/bin/bash
# Script pour suivre les logs en temps réel sur le serveur

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "📋 Logs en temps réel du serveur $SERVER_HOST..."

ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH
    echo "🔍 Logs en temps réel (Ctrl+C pour quitter):"
    docker-compose logs -f ygg-stremio-ad
EOF