#!/bin/bash
# Script pour tester différents niveaux de log

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

LOG_LEVEL=$1

if [ -z "$LOG_LEVEL" ]; then
    echo "Usage: $0 <LOG_LEVEL>"
    echo "Niveaux disponibles: error, warn, info, verbose, debug, silly"
    exit 1
fi

echo "🔧 Test du niveau de log: $LOG_LEVEL"

# Synchroniser et redémarrer avec le nouveau niveau de log
echo "📤 Synchronisation du code..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' \
    "$LOCAL_PROJECT_PATH/" \
    $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/

# Redémarrer avec le nouveau niveau de log
echo "🔄 Redémarrage avec LOG_LEVEL=$LOG_LEVEL..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH
    
    # Modifier temporairement le docker-compose.override.yml
    sed -i "s/LOG_LEVEL: .*/LOG_LEVEL: $LOG_LEVEL/" docker-compose.override.yml
    
    echo "🛑 Arrêt du conteneur..."
    docker-compose down
    
    echo "🚀 Redémarrage avec LOG_LEVEL=$LOG_LEVEL..."
    docker-compose up -d --build
    
    echo "⏳ Attente (10s)..."
    sleep 10
    
    echo "📋 Logs récents avec niveau $LOG_LEVEL:"
    docker-compose logs --tail=50 smart-blue-cat
EOF

echo "✅ Test terminé avec niveau $LOG_LEVEL"
echo "🌐 Testez sur : ${SERVER_URL:-https://$SERVER_HOST:5000}"
echo "📋 Pour voir les logs en continu : ygg-logs"