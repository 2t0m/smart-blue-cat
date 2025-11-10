#!/bin/bash
# Script pour tester et comparer différentes stratégies de recherche

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "🔍 Test des stratégies de recherche améliorées"
echo "============================================="

# Test 1: Épisode spécifique qui n'existe probablement pas
echo ""
echo "📺 TEST 1: Épisode rare (S04E18) - doit fallback vers saison complète"
echo "URL: http://$SERVER_HOST:5000/stream/series/tt0000000:1:1.json"

# Synchroniser le code amélioré
echo "📤 Synchronisation du code amélioré..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' \
    "$LOCAL_PROJECT_PATH/" \
    $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/ > /dev/null

# Redémarrer le service
echo "🔄 Redémarrage..."
ssh $SERVER_USER@$SERVER_HOST << EOF > /dev/null 2>&1
    cd $SERVER_PROJECT_PATH
    docker-compose down
    docker-compose up -d --build
    sleep 10
EOF

echo "🚀 Test en cours..."

# Test de la requête
RESPONSE=$(curl -s "http://$SERVER_HOST:5000/stream/series/tt0000000:1:1.json")
STREAM_COUNT=$(echo "$RESPONSE" | jq '.streams | length' 2>/dev/null || echo "0")

# S'assurer que STREAM_COUNT est un nombre
if ! [[ "$STREAM_COUNT" =~ ^[0-9]+$ ]]; then
    STREAM_COUNT=0
fi

echo "📊 Résultats:"
echo "   Streams trouvés: $STREAM_COUNT"

if [ "$STREAM_COUNT" -gt 0 ]; then
    echo "✅ SUCCÈS: Des streams ont été trouvés!"
    echo "$RESPONSE" | jq '.streams[0].name' 2>/dev/null | head -3
else
    echo "❌ Aucun stream trouvé"
    echo "📋 Réponse brute:"
    echo "$RESPONSE" | head -10
fi

echo ""
echo "📋 Voir les logs détaillés: ygg-logs"
echo "🔧 Test other episodes: ./scripts/test-search.sh tt0000000 [season] [episode]"
echo ""
echo "💡 Stratégies testées:"
echo "   1. 🎯 Épisode spécifique (S04E18) - patterns flexibles"
echo "   2. 📦 Saison complète (S04) - fallback fiable"  
echo "   3. 🗂️ Série complète - dernier recours"