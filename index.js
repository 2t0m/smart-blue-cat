const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const manifestRoutes = require('./routes/manifest');
const streamRoutes = require('./routes/stream');
const configRoutes = require('./routes/config');
const logger = require('./utils/logger');
const { getEnvironmentConfig, isSSLEnabled, getSSLConfig } = require('./utils/environment');

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
    });
  } catch (error) {
    logger.error(`❌ Failed to start HTTPS server: ${error.message}`);
    logger.info(`🔄 Falling back to HTTP server...`);
    
    // Fallback to HTTP if SSL fails
    http.createServer(app).listen(PORT, HOST, () => {
      logger.info(`✅ HTTP server running on ${HOST}:${PORT} (fallback)`);
    });
  }
} else {
  // Koyeb and other platforms that handle SSL termination
  http.createServer(app).listen(PORT, HOST, () => {
    logger.info(`✅ HTTP server running on ${HOST}:${PORT} (${envConfig.environment})`);
    logger.info(`🔗 Base URL: ${envConfig.baseUrl}`);
  });
}