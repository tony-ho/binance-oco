#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint func-names: ["warn", "as-needed"] */

const { createLogger, format, transports } = require('winston');

const loggerFormat = format.printf(info => `${info.timestamp} - ${JSON.stringify(info.message)}`);

const options = {
  console: {
    level: 'debug',
    handleExceptions: true,
    format: format.combine(
      format.timestamp(),
      format.colorize(),
      loggerFormat,
    ),
  },
  file: {
    level: 'info',
    filename: 'test.log',
    handleExceptions: true,
    format: format.combine(
      format.timestamp(),
      format.json(),
    ),
  },
};
const logger = createLogger({
  transports: [
    new transports.Console(options.console),
    new transports.File(options.file),
  ],
});

logger.info('Hello world!');
logger.error({ test: 'hi' });
