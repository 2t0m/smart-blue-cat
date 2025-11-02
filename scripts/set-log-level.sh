#!/bin/bash
# Script pour changer le niveau de log à chaud

# Charger la configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

LOG_LEVEL=$1

if [ -z "$LOG_LEVEL" ]; then
    echo "Usage: $0 <LOG_LEVEL>"
    echo ""
    echo "📋 Niveaux disponibles:"
    echo "  error   → ❌ Erreurs critiques seulement"
    echo "  warn    → ⚠️  Erreurs + Avertissements"  
    echo "  info    → ℹ️  Standard (requests, results)"
    echo "  verbose → 🔍 Détails étendus (searches, filters)"
    echo "  debug   → 🐛 Debug complet (every step)"
    echo "  silly   → 🔬 Ultra-détaillé (raw data)"
    echo ""
    echo "💡 Conseil: Commencez par 'debug' pour le développement"
    exit 1
fi

echo "🔧 Changement du niveau de log vers: $LOG_LEVEL"

# Modifier le fichier override
sed -i.bak "s/LOG_LEVEL: .*/LOG_LEVEL: $LOG_LEVEL/" docker-compose.override.yml

echo "✅ docker-compose.override.yml mis à jour"
echo "📋 Nouveau niveau: $LOG_LEVEL"
echo ""
echo "🚀 Pour appliquer le changement:"
echo "  ygg-sync  (pour tester immédiatement)"
echo "  ou"
echo "  ygg-deploy  (pour déployer après commit)"