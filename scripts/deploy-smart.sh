#!/bin/bash
# Script de déploiement intelligent multi-environnement

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

# Fonction d'aide
show_usage() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  local   → Déploiement sur serveur local ($SERVER_HOST)"
    echo "  koyeb   → Préparation pour déploiement Koyeb"
    echo "  auto    → Détection automatique (défaut)"
    echo ""
    echo "Exemples:"
    echo "  $0 local     # Force déploiement local"
    echo "  $0 koyeb     # Prépare pour Koyeb"
    echo "  $0           # Détection auto"
}

# Détecter l'environnement cible
detect_target_environment() {
    local forced_env="$1"
    
    if [ ! -z "$forced_env" ]; then
        echo "$forced_env"
        return
    fi
    
    # Auto-détection basée sur le contexte
    if command -v ssh >/dev/null 2>&1 && ssh -q -o ConnectTimeout=5 $SERVER_USER@$SERVER_HOST exit 2>/dev/null; then
        echo "local"
    else
        echo "koyeb"
    fi
}

# Déploiement local (serveur configuré)
deploy_local() {
    echo "🏠 Déploiement sur serveur local ($SERVER_HOST)..."
    
    # Vérifier les changements non committés
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ Vous avez des changements non committés. Veuillez les commit d'abord."
        exit 1
    fi

    # Push vers GitHub
    echo "📤 Push vers GitHub..."
    git push origin $(git branch --show-current)

    # Déploiement sur le serveur local
    echo "🔄 Déploiement sur le serveur local..."
    ssh $SERVER_USER@$SERVER_HOST << EOF
        cd $SERVER_PROJECT_PATH || { echo "❌ Dossier projet non trouvé"; exit 1; }
        
        echo "📥 Récupération des dernières modifications..."
        git pull origin main
        
        echo "🛑 Arrêt des conteneurs..."
        docker-compose -f docker-compose.local.yml down
        
        echo "🔨 Build et démarrage avec configuration locale..."
        docker-compose -f docker-compose.local.yml up -d --build
        
        echo "⏳ Attente du démarrage..."
        sleep 10
        
        echo "🔍 Vérification du statut..."
        docker-compose -f docker-compose.local.yml ps
        docker-compose -f docker-compose.local.yml logs --tail=20 ygg-stremio-ad-local
        
        echo "✅ Déploiement local terminé !"
EOF

    if [ $? -eq 0 ]; then
        echo "🎉 Déploiement local réussi !"
        echo "🌐 Addon disponible sur : ${SERVER_URL:-https://$SERVER_HOST:5000}"
        echo "🔍 Logs en temps réel : ygg-logs"
    else
        echo "❌ Échec du déploiement local"
        exit 1
    fi
}

# Préparation pour Koyeb
deploy_koyeb() {
    echo "☁️ Préparation pour déploiement Koyeb..."
    
    # Vérifier que tout est committé
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️ Changements non committés détectés - les committing maintenant..."
        git add .
        git commit -m "Deploy: Prepare for Koyeb deployment"
    fi
    
    # Push vers GitHub (déclenchera l'image Docker)
    echo "📤 Push vers GitHub..."
    git push origin main
    
    # Attendre que l'image soit buildée
    echo "⏳ Attente du build de l'image Docker..."
    sleep 30
    
    echo ""
    echo "✅ Préparation pour Koyeb terminée !"
    echo ""
    echo "📋 Prochaines étapes manuelles sur Koyeb :"
    echo "   1. Créer une nouvelle app sur https://app.koyeb.com/"
    echo "   2. Utiliser l'image : ghcr.io/2t0m/ygg-stremio-ad:latest"
    echo "   3. Configurer les variables d'environnement :"
    echo "      - DEPLOYMENT_TARGET=koyeb"
    echo "      - PORT=8000"
    echo "      - LOG_LEVEL=info"
    echo "      - CUSTOM_SEARCH_KEYWORDS=tt0098749=keyword"
    echo "      - Vos clés API (TMDB, AllDebrid, etc.)"
    echo "   4. Configurer le health check : /health"
    echo "   5. Déployer !"
    echo ""
    echo "💡 L'addon sera accessible via votre domaine Koyeb"
}

# Script principal
main() {
    local target_env="$1"
    
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
        exit 0
    fi
    
    local env=$(detect_target_environment "$target_env")
    
    echo "🚀 Déploiement YGG Stremio AD"
    echo "🎯 Environnement cible : $env"
    echo ""
    
    case "$env" in
        "local")
            deploy_local
            ;;
        "koyeb")
            deploy_koyeb
            ;;
        *)
            echo "❌ Environnement non reconnu : $env"
            show_usage
            exit 1
            ;;
    esac
}

# Lancer le script principal
main "$@"