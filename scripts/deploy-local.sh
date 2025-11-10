#!/bin/bash
# Deployment script to remote server with override

# Load configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

echo "🚀 Deploying and testing on $SERVER_HOST..."

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ You have uncommitted changes. Please commit them first."
    exit 1
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin $(git branch --show-current)

# Deploy to server with override for local build
echo "🔄 Deploying to server with local build..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    cd $SERVER_PROJECT_PATH || { echo "❌ Project folder not found"; exit 1; }
    
    echo "📥 Fetching latest changes..."
    git pull origin main
    
    echo "🛑 Stopping containers..."
    docker-compose down
    
    echo "🔨 Building and starting with override..."
    docker-compose up -d --build
    
    echo "⏳ Waiting for startup..."
    sleep 5
    
    echo "🔍 Checking status..."
    docker-compose ps
    docker-compose logs --tail=20 smart-blue-cat
    
    echo "✅ Deployment completed!"
EOF

echo "🎉 Deployment successful on $SERVER_HOST"
echo "🌐 Addon available at: ${SERVER_URL:-https://$SERVER_HOST:5000}"