#!/bin/bash
# Configuration personnalisable pour les scripts
# Copiez ce fichier vers config.local.sh et modifiez selon vos besoins

# Configuration par défaut (EXEMPLE - à personnaliser dans config.local.sh)
SERVER_HOST="192.168.1.100"
SERVER_USER="user"
SERVER_PROJECT_PATH="/home/user/smart-blue-cat"
LOCAL_PROJECT_PATH="/path/to/your/local/smart-blue-cat"

# Vous pouvez override ces variables dans config.local.sh
if [ -f "$(dirname "$0")/config.local.sh" ]; then
    source "$(dirname "$0")/config.local.sh"
fi