#!/bin/bash
# Script de test rapide sur le serveur distant avec override

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "🧪 Tests sur le serveur distant avec build local..."

# Synchroniser le code en cours (y compris les modifications non committées)
echo "📤 Synchronisation du code local..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' \
    "$LOCAL_PROJECT_PATH/" \
    $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/

# Exécuter les tests sur le serveur
echo "🔨 Build et test sur le serveur..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH
    
    echo "🛑 Arrêt des conteneurs existants..."
    docker-compose down
    
    echo "🔨 Build de l'image de test..."
    docker-compose build
    
    echo "🚀 Démarrage du conteneur de test..."
    docker-compose up -d
    
    echo "⏳ Attente du démarrage..."
    sleep 10
    
    echo "🔍 Vérification de l'état..."
    docker-compose ps
    
    echo "📋 Logs récents:"
    docker-compose logs --tail=30 smart-blue-cat
    
    echo "🌐 Test de connectivité:"
    curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/manifest.json || echo "❌ Service non accessible"
    
    if [ $? -eq 0 ]; then
        echo "✅ Tests réussis sur le serveur distant"
    else
        echo "❌ Tests échoués sur le serveur distant"
        exit 1
    fi
EOF

if [ $? -eq 0 ]; then
    echo "✅ Tests terminés avec succès"
    echo "🌐 Addon disponible sur : ${SERVER_URL:-https://$SERVER_HOST:5000}"
else
    echo "❌ Tests échoués"
    exit 1
fi