#!/bin/bash
# Script de déploiement vers le serveur distant avec override

echo "🚀 Déploiement et test sur 192.168.1.155..."

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
ssh thomas@192.168.1.155 << 'EOF'
    cd /home/thomas/ygg-stremio-ad || { echo "❌ Dossier projet non trouvé"; exit 1; }
    
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

echo "🎉 Déploiement réussi sur 192.168.1.155"
echo "🌐 Addon disponible sur : http://192.168.1.155:5000"