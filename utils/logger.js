const winston = require('winston');


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

const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';
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

logger.info(`[LOGGER INIT] LOG_LEVEL env = "${process.env.LOG_LEVEL}", using logLevel = "${logLevel}"`);


module.exports = logger;