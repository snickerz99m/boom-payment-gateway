const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'boom-payment-gateway' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    // Payment-specific log file
    new winston.transports.File({
      filename: path.join(logsDir, 'payments.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Security logging for sensitive operations
const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'boom-payment-gateway', category: 'security' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 20,
      tailable: true
    })
  ]
});

// Payment transaction logging
const paymentLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'boom-payment-gateway', category: 'payment' },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'transactions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 50,
      tailable: true
    })
  ]
});

// Helper functions for different log types
const logPaymentAttempt = (data) => {
  const sanitizedData = {
    transactionId: data.transactionId,
    amount: data.amount,
    currency: data.currency,
    cardType: data.cardType,
    cardLast4: data.cardLast4,
    cvvProvided: data.cvvProvided,
    riskLevel: data.riskLevel,
    timestamp: new Date().toISOString(),
    ipAddress: data.ipAddress,
    userAgent: data.userAgent
  };
  
  paymentLogger.info('Payment attempt', sanitizedData);
};

const logPaymentSuccess = (data) => {
  const sanitizedData = {
    transactionId: data.transactionId,
    amount: data.amount,
    currency: data.currency,
    cardType: data.cardType,
    cardLast4: data.cardLast4,
    processingTime: data.processingTime,
    timestamp: new Date().toISOString()
  };
  
  paymentLogger.info('Payment successful', sanitizedData);
};

const logPaymentFailure = (data) => {
  const sanitizedData = {
    transactionId: data.transactionId,
    amount: data.amount,
    currency: data.currency,
    cardType: data.cardType,
    cardLast4: data.cardLast4,
    errorCode: data.errorCode,
    errorMessage: data.errorMessage,
    timestamp: new Date().toISOString()
  };
  
  paymentLogger.error('Payment failed', sanitizedData);
};

const logSecurityEvent = (event, data) => {
  const sanitizedData = {
    event,
    userId: data.userId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    timestamp: new Date().toISOString(),
    details: data.details
  };
  
  securityLogger.warn('Security event', sanitizedData);
};

const logApiAccess = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };
  
  if (res.statusCode >= 400) {
    logger.warn('API request', logData);
  } else {
    logger.info('API request', logData);
  }
};

module.exports = {
  logger,
  securityLogger,
  paymentLogger,
  logPaymentAttempt,
  logPaymentSuccess,
  logPaymentFailure,
  logSecurityEvent,
  logApiAccess
};