#!/bin/bash
# Script de déploiement vers le serveur distant avec override

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "🚀 Déploiement et test sur $SERVER_HOST..."

# Vérifier les changements non committés
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Vous avez des changements non committés. Veuillez les commit d'abord."
    exit 1
fi

# Push vers GitHub
echo "📤 Push vers GitHub..."
git push origin $(git branch --show-current)

# Déploiement sur le serveur avec override pour build local
echo "🔄 Déploiement sur le serveur avec build local..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH || { echo "❌ Dossier projet non trouvé"; exit 1; }
    
    echo "📥 Récupération des dernières modifications..."
    git pull origin main
    
    echo "🛑 Arrêt des conteneurs..."
    docker-compose down
    
    echo "🔨 Build et démarrage avec override..."
    docker-compose up -d --build
    
    echo "⏳ Attente du démarrage..."
    sleep 5
    
    echo "🔍 Vérification du statut..."
    docker-compose ps
    docker-compose logs --tail=20 ygg-stremio-ad
    
    echo "✅ Déploiement terminé !"
EOF

echo "🎉 Déploiement réussi sur $SERVER_HOST"
echo "🌐 Addon disponible sur : ${SERVER_URL:-https://$SERVER_HOST:5000}"