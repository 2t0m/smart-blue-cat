#!/bin/bash
# Smart multi-environment deployment script

# Load configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config.sh"

# Help function
show_usage() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "ENVIRONMENT:"
    echo "  local   → Deploy to local server ($SERVER_HOST)"
    echo "  koyeb   → Prepare for Koyeb deployment"
    echo "  auto    → Automatic detection (default)"
    echo ""
    echo "Examples:"
    echo "  $0 local     # Force local deployment"
    echo "  $0 koyeb     # Prepare for Koyeb"
    echo "  $0           # Auto detection"
}

# Detect target environment
detect_target_environment() {
    local forced_env="$1"
    
    if [ ! -z "$forced_env" ]; then
        echo "$forced_env"
        return
    fi
    
    # Auto-detection based on context
    if command -v ssh >/dev/null 2>&1 && ssh -q -o ConnectTimeout=5 $SERVER_USER@$SERVER_HOST exit 2>/dev/null; then
        echo "local"
    else
        echo "koyeb"
    fi
}

# Local deployment (configured server)
deploy_local() {
    echo "🏠 Deploying to local server ($SERVER_HOST)..."
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ You have uncommitted changes. Please commit them first."
        exit 1
    fi

    # Push to GitHub
    echo "📤 Pushing to GitHub..."
    git push origin $(git branch --show-current)

    # Deploy to local server
    echo "🔄 Deploying to local server..."
    ssh $SERVER_USER@$SERVER_HOST << EOF
        cd $SERVER_PROJECT_PATH || { echo "❌ Project folder not found"; exit 1; }
        
        echo "📥 Fetching latest changes..."
        git pull origin main
        
        echo "🛑 Stopping containers..."
        docker-compose -f docker-compose.local.yml down
        
        echo "🔨 Building and starting with local configuration..."
        docker-compose -f docker-compose.local.yml up -d --build
        
        echo "⏳ Waiting for startup..."
        sleep 10
        
        echo "🔍 Checking status..."
        docker-compose -f docker-compose.local.yml ps
        docker-compose -f docker-compose.local.yml logs --tail=20 smart-blue-cat-local
        
        echo "✅ Local deployment completed!"
EOF

    if [ $? -eq 0 ]; then
        echo "🎉 Local deployment successful!"
        echo "🌐 Addon available at: ${SERVER_URL:-https://$SERVER_HOST:5000}"
        echo "🔍 Real-time logs: smart-blue-cat-logs"
    else
        echo "❌ Local deployment failed"
        exit 1
    fi
}

# Prepare for Koyeb
deploy_koyeb() {
    echo "☁️ Preparing for Koyeb deployment..."
    
    # Check that everything is committed
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️ Uncommitted changes detected - committing now..."
        git add .
        git commit -m "Deploy: Prepare for Koyeb deployment"
    fi
    
    # Push to GitHub (will trigger Docker image)
    echo "📤 Pushing to GitHub..."
    git push origin main
    
    # Wait for Docker image to be built
    echo "⏳ Waiting for Docker image build..."
    sleep 30
    
    echo ""
    echo "✅ Koyeb preparation completed!"
    echo ""
    echo "📋 Next manual steps on Koyeb:"
    echo "   1. Create a new app on https://app.koyeb.com/"
    echo "   2. Use image: ghcr.io/2t0m/smart-blue-cat:latest"
    echo "   3. Configure environment variables:"
    echo "      - DEPLOYMENT_TARGET=koyeb"
    echo "      - PORT=8000"
    echo "      - LOG_LEVEL=info"
    echo "      - CUSTOM_SEARCH_KEYWORDS=tt0000000=keyword"
    echo "      - Your API keys (TMDB, AllDebrid, etc.)"
    echo "   4. Configure health check: /health"
    echo "   5. Deploy!"
    echo ""
    echo "💡 The addon will be accessible via your Koyeb domain"
}

# Main script
main() {
    local target_env="$1"
    
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
        exit 0
    fi
    
    local env=$(detect_target_environment "$target_env")
    
    echo "🚀 Smart Blue Cat Deployment"
    echo "🎯 Target environment: $env"
    echo ""
    
    case "$env" in
        "local")
            deploy_local
            ;;
        "koyeb")
            deploy_koyeb
            ;;
        *)
            echo "❌ Environment not recognized: $env"
            show_usage
            exit 1
            ;;
    esac
}

# Lancer le script principal
main "$@"