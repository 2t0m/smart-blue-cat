#!/bin/bash
# Configuration initiale pour le workflow de développement multi-environnement

echo "🛠️  Configuration du workflow YGG Stremio AD..."

# Créer la configuration locale si elle n'existe pas
if [ ! -f "scripts/config.local.sh" ]; then
    echo "⚙️  Création de la configuration locale..."
    cp scripts/config.local.sh.example scripts/config.local.sh
    echo "📝 Fichier scripts/config.local.sh créé depuis l'exemple"
    echo "� Veuillez éditer scripts/config.local.sh avec vos informations de serveur"
fi

# Rendre les scripts exécutables
chmod +x scripts/*.sh

# Créer des alias utiles (mise à jour avec nouveaux scripts)
echo "📝 Configuration des alias zsh..."
{
    echo ""
    echo "# === YGG Stremio AD Aliases ==="
    echo 'alias ygg-deploy="./scripts/deploy-smart.sh"'      # Nouveau : déploiement intelligent
    echo 'alias ygg-deploy-local="./scripts/deploy-local.sh"' # Ancien : spécifique local
    echo 'alias ygg-test="./scripts/test-remote.sh"'
    echo 'alias ygg-sync="./scripts/sync-and-test.sh"'
    echo 'alias ygg-logs="./scripts/logs.sh"'
    echo 'alias ygg-server="ssh $SERVER_USER@$SERVER_HOST"'   # Utilise la config
    echo 'alias ygg-koyeb="./scripts/koyeb-helper.sh"'      # Nouveau : aide Koyeb
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
echo "  ygg-deploy       → Déploiement intelligent (auto-détection)"
echo "  ygg-deploy-local → Déploiement serveur local"
echo "  ygg-sync         → Sync + test instantané (sans commit)"
echo "  ygg-test         → Test complet sur serveur"
echo "  ygg-logs         → Logs en temps réel"
echo "  ygg-server       → Connexion SSH au serveur"
echo "  ygg-koyeb        → Aide pour déploiement Koyeb"
echo ""
echo "🌐 Environnements supportés :"
echo "  Local  : Serveur configuré (SSL + /data)"
echo "  Koyeb  : *.koyeb.app:8000   (HTTP + /tmp)"
echo ""
echo "📖 Guides disponibles :"
echo "  cat SCRIPTS-GUIDE.md → Guide détaillé des scripts"
echo "  cat DEPLOYMENT.md    → Documentation déploiement"
echo "  ygg-koyeb config     → Configuration Koyeb"
echo ""
echo "🔧 Configuration :"
echo "  Éditez scripts/config.local.sh avec vos informations de serveur"
echo "  Voir scripts/config.local.sh.example pour le format"