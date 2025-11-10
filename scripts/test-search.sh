#!/bin/bash
# Script pour tester une recherche spécifique et voir les logs détaillés

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

IMDB_ID=$1
SEASON=$2
EPISODE=$3

if [ -z "$IMDB_ID" ]; then
    echo "Usage: $0 <IMDB_ID> [SEASON] [EPISODE]"
    echo ""
    echo "Exemples:"
    echo "  $0 tt0000000 1 1     # Example series S01E01"
    echo "  $0 tt0000001          # Example movie (no season/episode)"
    echo ""
    exit 1
fi

echo "🔍 Test de recherche pour IMDB: $IMDB_ID"
if [ -n "$SEASON" ] && [ -n "$EPISODE" ]; then
    echo "   Saison: $SEASON, Épisode: $EPISODE"
    REQUEST_URL="http://$SERVER_HOST:5000/stream/series/${IMDB_ID}:${SEASON}:${EPISODE}.json"
else
    echo "   Type: Film"
    REQUEST_URL="http://$SERVER_HOST:5000/stream/movie/${IMDB_ID}.json"
fi

echo "🌐 URL de test: $REQUEST_URL"
echo ""

# Synchroniser d'abord le code
echo "📤 Synchronisation du code..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' \
    "$LOCAL_PROJECT_PATH/" \
    $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/ > /dev/null

# Redémarrer le service
echo "🔄 Redémarrage du service..."
ssh $SERVER_USER@$SERVER_HOST << EOF > /dev/null 2>&1
    cd $SERVER_PROJECT_PATH
    docker-compose down
    docker-compose up -d --build
    sleep 8
EOF

echo "🚀 Test en cours..."

# Faire la requête et capturer les logs en parallèle
ssh $SERVER_USER@$SERVER_HOST "cd $SERVER_PROJECT_PATH && docker-compose logs -f smart-blue-cat" &
LOG_PID=$!

sleep 2

# Faire la requête
curl -s "$REQUEST_URL" | jq '.' > /tmp/response.json

sleep 3
kill $LOG_PID 2>/dev/null

echo ""
echo "📋 Résultat de la requête:"
cat /tmp/response.json

echo ""
echo "✅ Test terminé"
echo "📋 Pour voir tous les logs: ygg-logs"