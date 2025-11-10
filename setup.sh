#!/bin/bash
# Initial configuration for multi-environment development workflow

echo "🛠️  Setting up Smart Blue Cat workflow..."

# Create local configuration if it doesn't exist
if [ ! -f "scripts/config.local.sh" ]; then
    echo "⚙️  Creating local configuration..."
    cp scripts/config.local.sh.example scripts/config.local.sh
    echo "📝 File scripts/config.local.sh created from example"
    echo "❗ Please edit scripts/config.local.sh with your server information"
fi

# Make scripts executable
chmod +x scripts/*.sh

# Create useful aliases (updated with new scripts)
echo "📝 Configuring zsh aliases..."
{
    echo ""
    echo "# === Smart Blue Cat Aliases ==="
    echo 'alias ygg-deploy="./scripts/deploy-smart.sh"'      # New: smart deployment
    echo 'alias ygg-deploy-local="./scripts/deploy-local.sh"' # Old: local specific
    echo 'alias ygg-test="./scripts/test-remote.sh"'
    echo 'alias ygg-sync="./scripts/sync-and-test.sh"'
    echo 'alias ygg-logs="./scripts/logs.sh"'
    echo 'alias ygg-server="ssh $SERVER_USER@$SERVER_HOST"'   # Uses config
    echo 'alias ygg-koyeb="./scripts/koyeb-helper.sh"'      # New: Koyeb helper
    echo ""
} >> ~/.zshrc

# Configure Git for this project
echo "⚙️  Configuring Git..."
git config user.name "$(git config --global user.name)"
git config user.email "$(git config --global user.email)"

# Check Docker override configuration
if [ -f "docker-compose.override.yml" ]; then
    echo "✅ docker-compose.override.yml detected"
else
    echo "⚠️  docker-compose.override.yml not found"
fi

# Reload zsh configuration
source ~/.zshrc 2>/dev/null || echo "⚠️  Restart your terminal or run 'source ~/.zshrc'"

echo ""
echo "✅ Configuration complete!"
echo ""
echo "🚀 Available commands:"
echo "  ygg-deploy       → Smart deployment (auto-detection)"
echo "  ygg-deploy-local → Local server deployment"
echo "  ygg-sync         → Sync + instant test (no commit)"
echo "  ygg-test         → Full server test"
echo "  ygg-logs         → Real-time logs"
echo "  ygg-server       → SSH connection to server"
echo "  ygg-koyeb        → Koyeb deployment helper"
echo ""
echo "🌐 Supported environments:"
echo "  Local  : Configured server (SSL + /data)"
echo "  Koyeb  : *.koyeb.app:8000   (HTTP + /tmp)"
echo ""
echo "📖 Available guides:"
echo "  cat SCRIPTS-GUIDE.md → Detailed script guide"
echo "  cat DEPLOYMENT.md    → Deployment documentation"
echo "  ygg-koyeb config     → Koyeb configuration"
echo ""
echo "🔧 Configuration:"
echo "  Edit scripts/config.local.sh with your server information"
echo "  See scripts/config.local.sh.example for format"
echo ""
echo "💡 Easy access tip:"
echo "  For IP 192.168.1.100, access via: https://192-168-1-100.local-ip.sh:5000"
echo "  (Replace dots with dashes in your IP address)"