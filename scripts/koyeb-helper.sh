#!/bin/bash
# Script d'aide pour la configuration et le debug Koyeb

show_koyeb_config() {
    echo "📋 Configuration recommandée pour Koyeb"
    echo "========================================="
    echo ""
    echo "🐳 Image Docker :"
    echo "   ghcr.io/2t0m/ygg-stremio-ad:latest"
    echo ""
    echo "🔧 Variables d'environnement essentielles :"
    echo "   DEPLOYMENT_TARGET=koyeb"
    echo "   PORT=8000"
    echo "   LOG_LEVEL=info"
    echo ""
    echo "🔧 Variables d'environnement de votre app :"
    echo "   TMDB_API_KEY=votre_clé_tmdb"
    echo "   API_KEY_ALLEDBRID=votre_clé_alldebrid"
    echo "   SHAREWOOD_PASSKEY=votre_passkey_sharewood"
    echo "   CUSTOM_SEARCH_KEYWORDS=tt0098749=keyword"
    echo ""
    echo "🏥 Health check :"
    echo "   Path: /health"
    echo "   Port: 8000"
    echo "   Interval: 30s"
    echo ""
    echo "📡 Réseau :"
    echo "   Port d'écoute: 8000"
    echo "   Protocole: HTTP (Koyeb gère HTTPS)"
    echo ""
    echo "💾 Stockage :"
    echo "   Database: /tmp (temporaire, pas de volume persistant)"
    echo ""
}

test_koyeb_image() {
    echo "🧪 Test de l'image Docker en mode Koyeb..."
    
    # Tester l'image localement avec les variables Koyeb
    docker run --rm -p 8000:8000 \
        -e DEPLOYMENT_TARGET=koyeb \
        -e PORT=8000 \
        -e LOG_LEVEL=debug \
        -e KOYEB_APP_NAME=test \
        ghcr.io/2t0m/ygg-stremio-ad:latest &
    
    local docker_pid=$!
    echo "📦 Container démarré (PID: $docker_pid)"
    
    # Attendre le démarrage
    echo "⏳ Attente du démarrage (15s)..."
    sleep 15
    
    # Test du health check
    echo "🏥 Test du health check..."
    if curl -s http://localhost:8000/health | jq . 2>/dev/null; then
        echo "✅ Health check OK"
    else
        echo "❌ Health check failed"
    fi
    
    # Test du manifest
    echo "📄 Test du manifest..."
    if curl -s http://localhost:8000/config 2>/dev/null | head -5; then
        echo "✅ Config page accessible"
    else
        echo "❌ Config page failed"
    fi
    
    # Nettoyer
    echo "🧹 Nettoyage..."
    docker stop $(docker ps -q --filter ancestor=ghcr.io/2t0m/ygg-stremio-ad:latest) 2>/dev/null
    
    echo "✅ Test terminé"
}

show_koyeb_urls() {
    local domain="$1"
    
    if [ -z "$domain" ]; then
        echo "Usage: $0 urls <votre-domaine.koyeb.app>"
        echo "Exemple: $0 urls my-addon-12345.koyeb.app"
        return
    fi
    
    echo "🔗 URLs de votre addon Koyeb"
    echo "============================"
    echo ""
    echo "🏥 Health check :"
    echo "   https://$domain/health"
    echo ""
    echo "⚙️ Configuration :"
    echo "   https://$domain/config"
    echo ""
    echo "📄 Manifest (avec config encodée) :"
    echo "   https://$domain/[CONFIG_BASE64]/manifest.json"
    echo ""
    echo "🎬 Exemple stream :"
    echo "   https://$domain/[CONFIG_BASE64]/stream/movie/tt1234567.json"
    echo ""
    echo "💡 Pour générer [CONFIG_BASE64], utilisez la page de config"
}

show_troubleshooting() {
    echo "🔧 Troubleshooting Koyeb"
    echo "========================"
    echo ""
    echo "❌ Problèmes courants :"
    echo ""
    echo "1. 'Port 8000 not exposed'"
    echo "   → Vérifiez que PORT=8000 dans les variables d'environnement"
    echo ""
    echo "2. 'Health check failing'"
    echo "   → L'endpoint /health doit répondre en HTTP sur le port 8000"
    echo ""
    echo "3. 'SSL/HTTPS errors'"
    echo "   → L'app doit écouter en HTTP, Koyeb gère HTTPS automatiquement"
    echo ""
    echo "4. 'Database errors'"
    echo "   → Database utilise /tmp sur Koyeb (non-persistant)"
    echo ""
    echo "5. 'Environment not detected'"
    echo "   → Définir DEPLOYMENT_TARGET=koyeb"
    echo ""
    echo "🔍 Debug logs :"
    echo "   → Définir LOG_LEVEL=debug pour plus de détails"
    echo "   → Vérifier les logs de démarrage dans Koyeb"
}

# Menu principal
case "$1" in
    "config")
        show_koyeb_config
        ;;
    "test")
        test_koyeb_image
        ;;
    "urls")
        show_koyeb_urls "$2"
        ;;
    "troubleshoot"|"debug")
        show_troubleshooting
        ;;
    *)
        echo "🌐 Aide pour déploiement Koyeb"
        echo "==============================="
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commandes disponibles :"
        echo "  config        → Afficher la configuration recommandée"
        echo "  test          → Tester l'image Docker localement"
        echo "  urls <domain> → Générer les URLs d'accès"
        echo "  troubleshoot  → Guide de dépannage"
        echo ""
        echo "Exemples :"
        echo "  $0 config"
        echo "  $0 test"
        echo "  $0 urls my-addon.koyeb.app"
        echo "  $0 troubleshoot"
        ;;
esac