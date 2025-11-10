#!/bin/bash

# Detect environment and setup SSL accordingly
detect_environment() {
    if [ ! -z "$KOYEB_PUBLIC_DOMAIN" ] || [ ! -z "$KOYEB_DEPLOYMENT_ID" ] || [ ! -z "$KOYEB_APP_NAME" ]; then
        echo "koyeb"
    elif [ "$DEPLOYMENT_TARGET" = "local" ]; then
        echo "local"
    else
        echo "docker"
    fi
}

setup_ssl() {
    local env=$(detect_environment)
    
    echo "🌐 Environment detected: $env"
    
    if [ "$env" = "koyeb" ]; then
        echo "📄 Koyeb environment - SSL handled by platform, skipping certificate download"
        return 0
    fi
    
    # For local and docker environments, setup SSL certificates
    echo "🔒 Setting up SSL certificates for $env environment..."
    
    # Paths to SSL files
    KEY_PATH="/etc/ssl/private/server.key"
    CERT_PATH="/etc/ssl/certs/server.pem"
    
    # URLs of the files
    KEY_URL="https://local-ip.sh/server.key"
    CERT_URL="https://local-ip.sh/server.pem"
    
    # Check if the files already exist
    if [ ! -f "$KEY_PATH" ] || [ ! -f "$CERT_PATH" ]; then
        echo "📥 Downloading SSL certificates..."

        # Download the files
        curl -s -o "$KEY_PATH" "$KEY_URL"
        curl -s -o "$CERT_PATH" "$CERT_URL"

        # Verify if the files were successfully downloaded
        if [ -f "$KEY_PATH" ] && [ -f "$CERT_PATH" ]; then
            echo "✅ SSL certificates downloaded successfully!"

            # Apply proper permissions
            chmod 600 "$KEY_PATH"
            chmod 644 "$CERT_PATH"
        else
            echo "❌ Error: Failed to download SSL certificates."
            exit 1
        fi
    else
        echo "✅ SSL certificate already exists, no action required."
    fi
}

# Setup database directory based on environment
setup_database() {
    local env=$(detect_environment)
    
    if [ "$env" = "koyeb" ]; then
        DB_PATH="/tmp"
        echo "📂 Using temporary database path for Koyeb: $DB_PATH"
    else
        DB_PATH="/data"
        echo "📂 Using persistent database path: $DB_PATH"
    fi
    
    # Create directory if it doesn't exist
    mkdir -p "$DB_PATH"
    chmod 755 "$DB_PATH"
    
    # Export for use by the application
    export DB_PATH
}

# Main setup
echo "🚀 Starting YGG Stremio AD initialization..."

setup_database
setup_ssl

# Start the application with the provided arguments
exec "$@"