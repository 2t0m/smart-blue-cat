const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const manifestRoutes = require('./routes/manifest');
const streamRoutes = require('./routes/stream');
const configRoutes = require('./routes/config');
const logger = require('./utils/logger');
const { getEnvironmentConfig, isSSLEnabled, getSSLConfig } = require('./utils/environment');
const { cleanupOldMagnets } = require('./services/alldebrid');

const app = express();

// Get environment configuration
const envConfig = getEnvironmentConfig();
const PORT = envConfig.port;
const HOST = envConfig.host;

// Middleware CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Routes
app.use('/', configRoutes);
app.use('/', manifestRoutes);
app.use('/', streamRoutes);

// Health check endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    environment: envConfig.environment,
    timestamp: new Date().toISOString() 
  });
});

// Startup cleanup of old AllDebrid magnets
async function performStartupCleanup() {
  try {
    // Basic config with environment variables for cleanup
    const config = {
      API_KEY_ALLEDBRID: process.env.API_KEY_ALLEDBRID
    };
    
    if (config.API_KEY_ALLEDBRID) {
      logger.info("🧹 Performing startup cleanup of old AllDebrid magnets...");
      await cleanupOldMagnets(config);
      logger.info("✅ Startup cleanup completed");
    } else {
      logger.debug("⏭️ Skipping startup cleanup - no AllDebrid API key configured");
    }
  } catch (error) {
    logger.warn(`⚠️ Startup cleanup failed: ${error.message}`);
  }
}

// Start server based on environment
if (isSSLEnabled()) {
  const sslConfig = getSSLConfig();
  
  try {
    const sslOptions = {
      key: fs.readFileSync(sslConfig.keyPath),
      cert: fs.readFileSync(sslConfig.certPath)
    };

    https.createServer(sslOptions, app).listen(PORT, HOST, () => {
      logger.info(`✅ HTTPS server running on ${HOST}:${PORT} (${envConfig.environment})`);
      logger.info(`🔗 Base URL: ${envConfig.baseUrl}`);
      
      // Perform startup cleanup
      setTimeout(() => performStartupCleanup(), 2000);
    });
  } catch (error) {
    logger.error(`❌ Failed to start HTTPS server: ${error.message}`);
    logger.info(`🔄 Falling back to HTTP server...`);
    
    // Fallback to HTTP if SSL fails
    http.createServer(app).listen(PORT, HOST, () => {
      logger.info(`✅ HTTP server running on ${HOST}:${PORT} (fallback)`);
      
      // Perform startup cleanup
      setTimeout(() => performStartupCleanup(), 2000);
    });
  }
} else {
  // Koyeb and other platforms that handle SSL termination
  http.createServer(app).listen(PORT, HOST, () => {
    logger.info(`✅ HTTP server running on ${HOST}:${PORT} (${envConfig.environment})`);
    logger.info(`🔗 Base URL: ${envConfig.baseUrl}`);
    
    // Perform startup cleanup
    setTimeout(() => performStartupCleanup(), 2000);
  });
}