const winston = require('winston');

function configureLogger({ logLevel = 'info', silent = false } = {}) {
  winston.configure({
    exitOnError: false,
    level: logLevel,
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    silent,
  });

  return winston;
}

module.exports = {
  configureLogger,
};
