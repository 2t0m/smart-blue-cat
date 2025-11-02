#!/bin/bash
# Configuration initiale pour le workflow de développement

echo "🛠️  Configuration du workflow YGG Stremio AD..."

# Rendre les scripts exécutables
chmod +x scripts/*.sh

# Créer des alias utiles
echo "📝 Configuration des alias zsh..."
{
    echo ""
    echo "# === YGG Stremio AD Aliases ==="
    echo 'alias ygg-deploy="./scripts/deploy-local.sh"'
    echo 'alias ygg-test="./scripts/test-remote.sh"'
    echo 'alias ygg-sync="./scripts/sync-and-test.sh"'
    echo 'alias ygg-logs="./scripts/logs.sh"'
    echo 'alias ygg-server="ssh thomas@192.168.1.155"'
    echo ""
} >> ~/.zshrc

# Configurer Git pour ce projet
echo "⚙️  Configuration Git..."
git config user.name "$(git config --global user.name)"
git config user.email "$(git config --global user.email)"

# Vérifier la configuration Docker override
if [ -f "docker-compose.override.yml" ]; then
    echo "✅ docker-compose.override.yml détecté"
else
    echo "⚠️  docker-compose.override.yml non trouvé"
fi

# Recharger la configuration zsh
source ~/.zshrc 2>/dev/null || echo "⚠️  Relancez votre terminal ou tapez 'source ~/.zshrc'"

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "🚀 Commandes disponibles :"
echo "  ygg-sync     → Sync + test instantané (sans commit)"
echo "  ygg-test     → Test complet sur serveur"
echo "  ygg-deploy   → Déploiement après commit"
echo "  ygg-logs     → Logs en temps réel"
echo "  ygg-server   → Connexion SSH au serveur"
echo ""
echo "🔧 Debug et logs :"
echo "  ./scripts/test-log-level.sh <level>  → Tester un niveau de log"
echo "  Niveaux: error, warn, info, verbose, debug, silly"
echo "  Voir LOG-LEVELS.md pour plus de détails"
echo ""
echo "📁 Configuration :"
echo "  Local:  /Users/thomas/Visual Studio Code/ygg-stremio-ad"
echo "  Serveur: /home/thomas/ygg-stremio-ad"
echo "  Données: /docker_data/ygg-stremio-ad/data"
echo "  URL:     http://192.168.1.155:5000"