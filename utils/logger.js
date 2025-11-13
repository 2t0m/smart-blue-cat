const winston = require('winston');

const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
console.log(`[LOGGER INIT] LOG_LEVEL env = "${process.env.LOG_LEVEL}", using logLevel = "${logLevel}"`);

// Define custom levels for more granularity
const customLevels = {
  levels: {
    error: 0,
    warn: 1, 
    info: 2,
    verbose: 3,
    debug: 4,
    silly: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green', 
    verbose: 'cyan',
    debug: 'blue',
    silly: 'magenta'
  }
};

winston.addColors(customLevels.colors);

const logger = winston.createLogger({
  level: logLevel,
  levels: customLevels.levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Add specialized logging methods
logger.request = (message) => logger.info(`📥 ${message}`);
logger.search = (message) => logger.verbose(`🔍 ${message}`);
logger.filter = (message) => logger.debug(`🎯 ${message}`);
logger.result = (message) => logger.info(`✅ ${message}`);
logger.upload = (message) => logger.verbose(`🔄 ${message}`);
logger.unlock = (message) => logger.debug(`🔓 ${message}`);
logger.skip = (message) => logger.debug(`⏭️ ${message}`);

module.exports = logger;