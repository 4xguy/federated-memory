import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || 'federated-memory.log';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

// Create the logger
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'federated-memory' },
  transports: [
    // Write all logs with importance level of `error` or less to error.log
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join('logs', logFile),
    }),
  ],
});

// If we're not in production, log to the console too
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

// Create a child logger for specific modules
export function createModuleLogger(moduleName: string) {
  return logger.child({ module: moduleName });
}

// Export Logger class for compatibility
export class Logger {
  private static instance: Logger;

  private constructor(private winstonLogger: winston.Logger) {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(logger);
    }
    return Logger.instance;
  }

  info(message: string, meta?: any): void {
    this.winstonLogger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.winstonLogger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.winstonLogger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.winstonLogger.debug(message, meta);
  }

  child(meta: any): winston.Logger {
    return this.winstonLogger.child(meta);
  }
}
