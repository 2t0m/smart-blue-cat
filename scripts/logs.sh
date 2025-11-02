#!/bin/bash
# Script pour suivre les logs en temps réel sur le serveur

echo "📋 Logs en temps réel du serveur 192.168.1.155..."

ssh thomas@192.168.1.155 << 'EOF'
    cd /home/thomas/ygg-stremio-ad
    echo "🔍 Logs en temps réel (Ctrl+C pour quitter):"
    docker-compose logs -f ygg-stremio-ad
EOF