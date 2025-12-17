// Environment detection and configuration for multi-platform deployment
const path = require('path');
const logger = require('./logger');

// Prevent multiple initialization logs
let isInitialized = false;

/**
 * Detect the current deployment environment
 * @returns {string} Environment type: 'local' or 'docker'
 */
function detectEnvironment() {
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
    local: {
      environment: 'local',
      sslEnabled: true,   // Local server needs SSL for Stremio
      port: process.env.PORT || 5000,
      host: '0.0.0.0',
      sslCertPath: '/etc/ssl/certs/server.pem',
      sslKeyPath: '/etc/ssl/private/server.key',
      baseUrl: process.env.BASE_URL || 'https://your-server-ip:5000'
    },
    
    docker: {
      environment: 'docker',
      sslEnabled: true,   // Default to SSL for Docker
      port: process.env.PORT || 5000,
      host: '0.0.0.0',
      sslCertPath: '/etc/ssl/certs/server.pem',
      sslKeyPath: '/etc/ssl/private/server.key',
      baseUrl: process.env.BASE_URL || 'https://localhost:5000'
    }
  };
  
  const config = configs[env] || configs.local;
  
  // Only log on first initialization to prevent spam
  if (!isInitialized) {
    logger.debug(`[environment] detectEnvironment IN`);
    logger.info(`🌐 Environment detected: ${config.environment}`);
    logger.info(`📊 Config - SSL: ${config.sslEnabled ? '✅' : '❌'}, Port: ${config.port}`);
    logger.debug(`[environment] detectEnvironment OUT`);
    logger.debug(`🔗 Base URL: ${config.baseUrl}`);
    isInitialized = true;
  }
  
  return config;
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
  isSSLEnabled,
  getSSLConfig
};