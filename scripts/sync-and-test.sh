#!/bin/bash
# Script de synchronisation rapide pour tester des modifications en cours

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "⚡ Test rapide sur serveur distant (sans commit)..."

# Synchroniser TOUS les fichiers (même non committés)
echo "📤 Synchronisation des modifications locales..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' \
    "$LOCAL_PROJECT_PATH/" \
    $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/

# Restart rapide sur le serveur
echo "🔄 Restart rapide du service..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH
    
    echo "🛑 Arrêt du conteneur..."
    docker-compose down
    
    echo "🚀 Redémarrage avec build..."
    docker-compose up -d --build
    
    echo "⏳ Attente (5s)..."
    sleep 5
    
    echo "📋 Status:"
    docker-compose ps
    
    echo "📝 Logs récents:"
    docker-compose logs --tail=10 ygg-stremio-ad
EOF

echo "✅ Synchronisation terminée"
echo "🌐 Testez sur : ${SERVER_URL:-https://$SERVER_HOST:5000}"