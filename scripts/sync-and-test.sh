#!/bin/bash
# Quick sync script to test ongoing changes

# Load configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "⚡ Quick test on remote server (no commit)..."

# Sync ALL files (even uncommitted ones)
echo "📤 Syncing local changes..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' \
    "$LOCAL_PROJECT_PATH/" \
    $SERVER_USER@$SERVER_HOST:$SERVER_PROJECT_PATH/

# Quick restart on server
echo "🔄 Quick service restart..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH
    
    echo "=== 🛑 Stopping container ==="
    docker-compose down
    
    echo "=== 🚀 Restarting with build ==="
    docker-compose up -d --build
    
    echo "=== ⏳ Wait (10s) ==="
    sleep 10
    
    echo "=== 📋 Status ==="
    docker-compose ps
    
    echo "=== 📝 Startup logs ==="
    docker-compose logs --tail=25 smart-blue-cat
    
    echo "=== ✅ Restart completed ==="
EOF

echo ""
echo "✅ Synchronization completed"
echo "🌐 Test at: ${SERVER_URL:-https://$SERVER_HOST:5000}"
echo ""

# Offer to show real-time logs
read -p "📋 Want to see real-time logs? (y/N): " show_logs
if [[ $show_logs =~ ^[yY] ]]; then
    echo "📺 Real-time logs (Ctrl+C to quit)..."
    ssh -t $SERVER_USER@$SERVER_HOST "cd $SERVER_PROJECT_PATH && docker-compose logs -f smart-blue-cat"
fi