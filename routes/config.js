const express = require('express');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../utils/helpers');
const logger = require('../utils/logger');
const { allDebridRateLimiter, allDebridCircuitBreaker } = require('../utils/rateLimit');
const CacheManager = require('../utils/cache');

const router = express.Router();

// Serve the static configuration page
router.get('/configure', (req, res) => {
  const configPath = path.join(__dirname, '../public/config.html');

  res.sendFile(configPath, (err) => {
    if (err) {
      logger.error("❌ Error serving the configuration page:", err.message);
      res.status(500).send("Error loading configuration page.");
    }
  });
});

// Serve the addon logo
router.get('/logo.png', (req, res) => {
  // Try PNG first, then SVG, then placeholder
  const logoPngPath = path.join(__dirname, '../public/logo.png');
  const logoSvgPath = path.join(__dirname, '../public/logo.svg');
  
  // Check if PNG exists (priority)
  if (fs.existsSync(logoPngPath)) {
    res.sendFile(logoPngPath);
    return;
  }
  
  // Check if SVG exists (fallback)
  if (fs.existsSync(logoSvgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(logoSvgPath);
    return;
  }
  
  // Fallback to placeholder
  logger.warn("❌ Logo files not found, serving placeholder");
  const svgLogo = `
    <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" fill="#4A90E2" rx="20"/>
      <text x="64" y="75" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">🐱</text>
      <text x="64" y="100" text-anchor="middle" fill="white" font-family="Arial" font-size="12">Smart Blue Cat</text>
    </svg>
  `;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svgLogo);
});

// Serve the dynamic configuration page
router.get('/:variables/configure', (req, res) => {
  let config;

  // Retrieve configuration
  try {
    config = getConfig(req);
  } catch (e) {
    logger.error("❌ Invalid configuration in request:", e.message);
    return res.status(400).send("Invalid configuration!");
  }

  const configPath = path.join(__dirname, '../public/config.html');

  // Read and process the HTML file
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      logger.error("❌ Error reading the configuration page:", err.message);
      return res.status(500).send("Error loading configuration page.");
    }

    // Replace placeholders in the HTML with configuration values
    const page = data
      .replace(/{{TMDB_API_KEY}}/g, config.TMDB_API_KEY || '')
      .replace(/{{API_KEY_ALLEDBRID}}/g, config.API_KEY_ALLEDBRID || '')
      .replace(/{{FILES_TO_SHOW}}/g, config.FILES_TO_SHOW || 5)
      .replace(/{{RES_TO_SHOW}}/g, config.RES_TO_SHOW ? config.RES_TO_SHOW.join(', ') : '')
      .replace(/{{LANG_TO_SHOW}}/g, config.LANG_TO_SHOW ? config.LANG_TO_SHOW.join(', ') : '')
      .replace(/{{SHAREWOOD_PASSKEY}}/g, config.SHAREWOOD_PASSKEY || '');

    res.send(page);
  });
});

// Status endpoint for monitoring
router.get('/status', async (req, res) => {
  try {
    const rateLimiterStatus = allDebridRateLimiter.getStatus();
    const circuitBreakerStatus = allDebridCircuitBreaker.getStatus();
    const cacheStats = CacheManager.getStats();
    
    const status = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      rateLimiter: rateLimiterStatus,
      circuitBreaker: circuitBreakerStatus,
      cache: cacheStats,
      performance: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuUsage: process.cpuUsage(),
      },
      timestamp: new Date().toISOString()
    };
    
    logger.debug('📊 Status requested:', JSON.stringify(status, null, 2));
    res.json(status);
  } catch (error) {
    logger.error('❌ Error getting status:', error.message);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

module.exports = router;