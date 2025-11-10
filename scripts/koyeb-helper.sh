#!/bin/bash
# Koyeb configuration and debugging helper script

show_koyeb_config() {
    echo "📋 Recommended Koyeb configuration"
    echo "=================================="
    echo ""
    echo "🐳 Docker Image:"
    echo "   ghcr.io/2t0m/smart-blue-cat:latest"
    echo ""
    echo "🔧 Essential environment variables:"
    echo "   DEPLOYMENT_TARGET=koyeb"
    echo "   PORT=8000"
    echo "   LOG_LEVEL=info"
    echo ""
    echo "🔧 Your app environment variables:"
    echo "   TMDB_API_KEY=your_tmdb_key"
    echo "   API_KEY_ALLEDBRID=your_alldebrid_key"
    echo "   SHAREWOOD_PASSKEY=your_sharewood_passkey"
    echo "   CUSTOM_SEARCH_KEYWORDS=tt0000000=keyword"
    echo ""
    echo "🏥 Health check:"
    echo "   Path: /health"
    echo "   Port: 8000"
    echo "   Interval: 30s"
    echo ""
    echo "📡 Network:"
    echo "   Listen port: 8000"
    echo "   Protocol: HTTP (Koyeb handles HTTPS)"
    echo ""
    echo "💾 Storage:"
    echo "   Database: /tmp (temporary, no persistent volume)"
    echo ""
}

test_koyeb_image() {
    echo "🧪 Testing Docker image in Koyeb mode..."
    
    # Test image locally with Koyeb variables
    docker run --rm -p 8000:8000 \
        -e DEPLOYMENT_TARGET=koyeb \
        -e PORT=8000 \
        -e LOG_LEVEL=debug \
        -e KOYEB_APP_NAME=test \
        ghcr.io/2t0m/smart-blue-cat:latest &
    
    local docker_pid=$!
    echo "📦 Container started (PID: $docker_pid)"
    
    # Wait for startup
    echo "⏳ Waiting for startup (15s)..."
    sleep 15
    
    # Test health check
    echo "🏥 Testing health check..."
    if curl -s http://localhost:8000/health | jq . 2>/dev/null; then
        echo "✅ Health check OK"
    else
        echo "❌ Health check failed"
    fi
    
    # Test manifest
    echo "📄 Testing manifest..."
    if curl -s http://localhost:8000/config 2>/dev/null | head -5; then
        echo "✅ Config page accessible"
    else
        echo "❌ Config page failed"
    fi
    
    # Cleanup
    echo "🧹 Cleaning up..."
    docker stop $(docker ps -q --filter ancestor=ghcr.io/2t0m/smart-blue-cat:latest) 2>/dev/null
    
    echo "✅ Test completed"
}

show_koyeb_urls() {
    local domain="$1"
    
    if [ -z "$domain" ]; then
        echo "Usage: $0 urls <your-domain.koyeb.app>"
        echo "Example: $0 urls my-addon-12345.koyeb.app"
        return
    fi
    
    echo "🔗 Your Koyeb addon URLs"
    echo "========================"
    echo ""
    echo "🏥 Health check:"
    echo "   https://$domain/health"
    echo ""
    echo "⚙️ Configuration:"
    echo "   https://$domain/config"
    echo ""
    echo "📄 Manifest (with encoded config):"
    echo "   https://$domain/[CONFIG_BASE64]/manifest.json"
    echo ""
    echo "🎬 Example stream:"
    echo "   https://$domain/[CONFIG_BASE64]/stream/movie/tt1234567.json"
    echo ""
    echo "💡 To generate [CONFIG_BASE64], use the config page"
}

show_troubleshooting() {
    echo "🔧 Koyeb Troubleshooting"
    echo "========================"
    echo ""
    echo "❌ Common issues:"
    echo ""
    echo "1. 'Port 8000 not exposed'"
    echo "   → Check that PORT=8000 in environment variables"
    echo ""
    echo "2. 'Health check failing'"
    echo "   → The /health endpoint must respond in HTTP on port 8000"
    echo ""
    echo "3. 'SSL/HTTPS errors'"
    echo "   → App must listen in HTTP, Koyeb handles HTTPS automatically"
    echo ""
    echo "4. 'Database errors'"
    echo "   → Database uses /tmp on Koyeb (non-persistent)"
    echo ""
    echo "5. 'Environment not detected'"
    echo "   → Set DEPLOYMENT_TARGET=koyeb"
    echo ""
    echo "🔍 Debug logs:"
    echo "   → Set LOG_LEVEL=debug for more details"
    echo "   → Check startup logs in Koyeb"
}

# Main menu
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
        echo "🌐 Koyeb deployment help"
        echo "========================"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Available commands:"
        echo "  config        → Show recommended configuration"
        echo "  test          → Test Docker image locally"
        echo "  urls <domain> → Generate access URLs"
        echo "  troubleshoot  → Troubleshooting guide"
        echo ""
        echo "Examples:"
        echo "  $0 config"
        echo "  $0 test"
        echo "  $0 urls my-addon.koyeb.app"
        echo "  $0 troubleshoot"
        ;;
esac