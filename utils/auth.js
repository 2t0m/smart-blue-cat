// Authentication middleware for access control
const logger = require('./logger');

/**
 * Middleware to check access key authentication from config
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
function requireAccessKey(req, res, next) {
  const serverKey = process.env.ACCESS_KEY;
  
  // Access key must be configured on server
  if (!serverKey || serverKey === 'your-secret-key-here') {
    logger.error('❌ ACCESS_KEY not configured in environment variables');
    return res.status(500).json({
      error: 'Server misconfiguration',
      message: 'Access key not configured on server'
    });
  }
  
  // Extract key from user configuration (in base64 encoded config)
  let userConfig;
  try {
    if (req.params.variables) {
      const decoded = Buffer.from(req.params.variables, 'base64').toString('utf8');
      userConfig = JSON.parse(decoded);
    } else {
      logger.warn(`🔒 Access denied - No configuration provided from ${req.ip}`);
      return res.status(400).json({
        error: 'Configuration required',
        message: 'Please provide a valid configuration'
      });
    }
  } catch (e) {
    logger.warn(`🔒 Access denied - Invalid configuration from ${req.ip}`);
    return res.status(400).json({
      error: 'Invalid configuration',
      message: 'The configuration is malformed'
    });
  }
  
  const providedKey = userConfig.ACCESS_KEY;
  
  if (!providedKey) {
    logger.warn(`🔒 Access denied - No access key in config from ${req.ip}`);
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please include an access key in your configuration'
    });
  }
  
  if (providedKey !== serverKey) {
    logger.warn(`🔒 Access denied - Invalid key from ${req.ip}`);
    return res.status(403).json({
      error: 'Invalid access key',
      message: 'The provided access key is invalid'
    });
  }
  
  // Valid key - allow access
  logger.debug(`✅ Access granted with valid key from ${req.ip}`);
  next();
}

/**
 * Check if authentication is properly configured
 * @returns {boolean} True if access key is configured
 */
function isAuthEnabled() {
  const configuredKey = process.env.ACCESS_KEY;
  return !!(configuredKey && configuredKey !== 'your-secret-key-here');
}

/**
 * Get the configured access key (for display purposes only)
 * @returns {string|null} Masked access key or null
 */
function getAccessKeyInfo() {
  const configuredKey = process.env.ACCESS_KEY;
  if (!configuredKey || configuredKey === 'your-secret-key-here') {
    return null;
  }
  // Mask the key for security
  return configuredKey.substring(0, 4) + '***';
}

module.exports = {
  requireAccessKey,
  isAuthEnabled,
  getAccessKeyInfo
};
