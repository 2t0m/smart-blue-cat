// Environment detection and configuration for multi-platform deployment
const path = require('path');
const logger = require('./logger');

/**
 * Detect the current deployment environment
 * @returns {string} Environment type: 'koyeb', 'local', or 'docker'
 */
function detectEnvironment() {
  // Koyeb detection
  if (process.env.KOYEB_PUBLIC_DOMAIN || 
      process.env.KOYEB_DEPLOYMENT_ID || 
      process.env.KOYEB_APP_NAME) {
    return 'koyeb';
  }
  
  // Local server detection (via custom environment variable)
  if (process.env.DEPLOYMENT_TARGET === 'local') {
    return 'local';
  }
  
  // Check if running in a typical Docker environment
  if (process.env.HOSTNAME && process.env.HOSTNAME.length === 12) {
    // Most likely Docker container with random hostname
    return process.env.DEPLOYMENT_TARGET || 'docker';
  }
  
  // Default to local development
  return 'local';
}

/**
 * Get environment-specific configuration
 * @returns {object} Environment configuration
 */
function getEnvironmentConfig() {
  const env = detectEnvironment();
  
  const configs = {
    koyeb: {
      environment: 'koyeb',
      sslEnabled: false,  // Koyeb handles SSL/TLS termination
      dbPath: '/tmp',     // Temporary storage on Koyeb
      port: process.env.PORT || 8000,  // Koyeb typically uses port 8000
      host: '0.0.0.0',
      sslCertPath: null,
      sslKeyPath: null,
      baseUrl: process.env.KOYEB_PUBLIC_DOMAIN 
        ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}`
        : 'https://your-app.koyeb.app'
    },
    
    local: {
      environment: 'local',
      sslEnabled: true,   // Local server needs SSL for Stremio
      dbPath: '/data',    // Persistent storage
      port: process.env.PORT || 5000,
      host: '0.0.0.0',
      sslCertPath: '/etc/ssl/certs/server.pem',
      sslKeyPath: '/etc/ssl/private/server.key',
      baseUrl: process.env.BASE_URL || 'https://192.168.1.155:5000'
    },
    
    docker: {
      environment: 'docker',
      sslEnabled: true,   // Default to SSL for Docker
      dbPath: '/data',    // Use /data volume mount
      port: process.env.PORT || 5000,
      host: '0.0.0.0',
      sslCertPath: '/etc/ssl/certs/server.pem',
      sslKeyPath: '/etc/ssl/private/server.key',
      baseUrl: process.env.BASE_URL || 'https://localhost:5000'
    }
  };
  
  const config = configs[env] || configs.local;
  
  logger.info(`🌐 Environment detected: ${config.environment}`);
  logger.info(`📊 Config - SSL: ${config.sslEnabled ? '✅' : '❌'}, DB: ${config.dbPath}, Port: ${config.port}`);
  logger.debug(`🔗 Base URL: ${config.baseUrl}`);
  
  return config;
}

/**
 * Get the database path based on environment
 * @returns {string} Database file path
 */
function getDatabasePath() {
  const envConfig = getEnvironmentConfig();
  return path.join(envConfig.dbPath, 'streams.db');
}

/**
 * Check if SSL should be used in current environment
 * @returns {boolean} Whether SSL is enabled
 */
function isSSLEnabled() {
  const envConfig = getEnvironmentConfig();
  return envConfig.sslEnabled;
}

/**
 * Get SSL configuration if enabled
 * @returns {object|null} SSL configuration or null if disabled
 */
function getSSLConfig() {
  const envConfig = getEnvironmentConfig();
  
  if (!envConfig.sslEnabled) {
    return null;
  }
  
  return {
    keyPath: envConfig.sslKeyPath,
    certPath: envConfig.sslCertPath
  };
}

module.exports = {
  detectEnvironment,
  getEnvironmentConfig,
  getDatabasePath,
  isSSLEnabled,
  getSSLConfig
};