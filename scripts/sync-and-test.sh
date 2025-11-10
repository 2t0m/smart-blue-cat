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
    
    echo "=== 🛑 Arrêt du conteneur ==="
    docker-compose -f docker-compose.local.yml down
    
    echo "=== 🚀 Redémarrage avec build ==="
    docker-compose -f docker-compose.local.yml up -d --build
    
    echo "=== ⏳ Attente (10s) ==="
    sleep 10
    
    echo "=== 📋 Status ==="
    docker-compose -f docker-compose.local.yml ps
    
    echo "=== 📝 Logs de démarrage ==="
    docker-compose -f docker-compose.local.yml logs --tail=25 ygg-stremio-ad-local
    
    echo "=== ✅ Redémarrage terminé ==="
EOF

echo ""
echo "✅ Synchronisation terminée"
echo "🌐 Testez sur : ${SERVER_URL:-https://$SERVER_HOST:5000}"
echo ""

# Proposer de voir les logs en temps réel
read -p "📋 Voulez-vous voir les logs en temps réel ? (o/N): " show_logs
if [[ $show_logs =~ ^[oO] ]]; then
    echo "📺 Logs en temps réel (Ctrl+C pour quitter)..."
    ssh -t $SERVER_USER@$SERVER_HOST "cd $SERVER_PROJECT_PATH && docker-compose -f docker-compose.local.yml logs -f ygg-stremio-ad-local"
fi