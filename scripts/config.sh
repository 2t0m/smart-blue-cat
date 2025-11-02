#!/bin/bash
# Configuration personnalisable pour les scripts
# Copiez ce fichier vers config.local.sh et modifiez selon vos besoins

# Configuration par défaut
SERVER_HOST="192.168.1.155"
SERVER_USER="thomas"
SERVER_PROJECT_PATH="/home/thomas/ygg-stremio-ad"
LOCAL_PROJECT_PATH="/Users/thomas/Visual Studio Code/ygg-stremio-ad"

# Vous pouvez override ces variables dans config.local.sh
if [ -f "$(dirname "$0")/config.local.sh" ]; then
    source "$(dirname "$0")/config.local.sh"
fi