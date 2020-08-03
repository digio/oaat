const winston = require('winston');

const config = {
  levels: {
    error: 0,
    success: 1,
    warn: 2,
    info: 3,
    debug: 4,
    verbose: 5,
  },
  colors: {
    error: 'red',
    success: 'green',
    warn: 'yellow',
    info: 'blue',
    debug: 'magenta',
    verbose: 'cyan',
  },
};

winston.addColors(config.colors);

function configureLogger({ logLevel = 'info', silent = false } = {}) {
  winston.configure({
    exitOnError: false,
    levels: config.levels,
    level: logLevel,
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    silent,
  });

  // Add the success() method
  winston.success = (...args) => winston.log('success', ...args);

  return winston;
}

module.exports = {
  configureLogger,
};
