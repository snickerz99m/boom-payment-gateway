const { logger, logApiAccess } = require('../utils/logger');
const { generateErrorResponse } = require('../utils/helpers');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Handle different error types
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      generateErrorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  if (err.name === 'SequelizeValidationError') {
    const validationErrors = err.errors.map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));
    
    return res.status(400).json(
      generateErrorResponse(
        'Database validation failed',
        'VALIDATION_ERROR',
        isDevelopment ? { errors: validationErrors } : null
      )
    );
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json(
      generateErrorResponse(
        'Resource already exists',
        'DUPLICATE_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json(
      generateErrorResponse(
        'Invalid reference',
        'VALIDATION_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json(
      generateErrorResponse(
        'Database connection failed',
        'INTERNAL_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      generateErrorResponse(
        'Invalid token',
        'AUTHENTICATION_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      generateErrorResponse(
        'Token expired',
        'AUTHENTICATION_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    return res.status(400).json(
      generateErrorResponse(
        'Invalid JSON',
        'VALIDATION_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  // Handle payment-specific errors
  if (err.code === 'PAYMENT_ERROR') {
    return res.status(400).json(
      generateErrorResponse(
        err.message || 'Payment processing failed',
        'PAYMENT_ERROR',
        isDevelopment ? { details: err.details } : null
      )
    );
  }
  
  if (err.code === 'CARD_ERROR') {
    return res.status(400).json(
      generateErrorResponse(
        err.message || 'Card validation failed',
        'CARD_ERROR',
        isDevelopment ? { details: err.details } : null
      )
    );
  }
  
  if (err.code === 'INSUFFICIENT_FUNDS') {
    return res.status(400).json(
      generateErrorResponse(
        'Insufficient funds',
        'PAYMENT_ERROR',
        isDevelopment ? { details: err.details } : null
      )
    );
  }
  
  if (err.code === 'EXPIRED_CARD') {
    return res.status(400).json(
      generateErrorResponse(
        'Card expired',
        'CARD_ERROR',
        isDevelopment ? { details: err.details } : null
      )
    );
  }
  
  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(
      generateErrorResponse(
        'File too large',
        'VALIDATION_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json(
      generateErrorResponse(
        'CORS policy violation',
        'CORS_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  // Handle timeout errors
  if (err.code === 'TIMEOUT' || err.timeout) {
    return res.status(408).json(
      generateErrorResponse(
        'Request timeout',
        'TIMEOUT_ERROR',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  // Handle rate limit errors (should be handled by rate limit middleware)
  if (err.status === 429) {
    return res.status(429).json(
      generateErrorResponse(
        'Too many requests',
        'RATE_LIMIT_EXCEEDED',
        isDevelopment ? { details: err.message } : null
      )
    );
  }
  
  // Default error response
  const statusCode = err.status || err.statusCode || 500;
  const message = isDevelopment ? err.message : 'Internal server error';
  
  return res.status(statusCode).json(
    generateErrorResponse(
      message,
      'INTERNAL_ERROR',
      isDevelopment ? { 
        stack: err.stack,
        details: err.details 
      } : null
    )
  );
};

/**
 * 404 Not Found handler
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  
  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  return res.status(404).json(
    generateErrorResponse(
      `Cannot ${req.method} ${req.originalUrl}`,
      'NOT_FOUND_ERROR'
    )
  );
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 * @param {function} fn - Async function to wrap
 * @returns {function} - Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request timeout middleware
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {function} - Express middleware
 */
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = new Error('Request timeout');
        error.code = 'TIMEOUT';
        error.status = 408;
        next(error);
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    res.on('close', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
};

/**
 * API access logger middleware
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const apiLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logApiAccess(req, res, responseTime);
  });
  
  next();
};

/**
 * Request ID middleware
 * Adds a unique request ID to each request
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const requestId = (req, res, next) => {
  const { v4: uuidv4 } = require('uuid');
  
  req.requestId = req.get('X-Request-ID') || uuidv4();
  res.set('X-Request-ID', req.requestId);
  
  next();
};

/**
 * Security headers middleware
 * Adds security-related headers to responses
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const securityHeaders = (req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  next();
};

/**
 * Request sanitization middleware
 * Sanitizes request data to prevent injection attacks
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const sanitizeRequest = (req, res, next) => {
  const { sanitizeInput } = require('../utils/helpers');
  
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    }
  }
  
  // Sanitize body parameters (be careful with payment data)
  if (req.body && typeof req.body === 'object') {
    const sensitiveFields = ['cardNumber', 'cvv', 'password', 'token'];
    
    for (const key in req.body) {
      if (typeof req.body[key] === 'string' && !sensitiveFields.includes(key)) {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  
  next();
};

/**
 * Content type validation middleware
 * Ensures request has correct content type
 * @param {string} expectedType - Expected content type
 * @returns {function} - Express middleware
 */
const validateContentType = (expectedType = 'application/json') => {
  return (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!req.is(expectedType)) {
        return res.status(415).json(
          generateErrorResponse(
            `Content-Type must be ${expectedType}`,
            'VALIDATION_ERROR'
          )
        );
      }
    }
    
    next();
  };
};

/**
 * Request size limiter middleware
 * Limits request body size
 * @param {string} limit - Size limit (e.g., '10mb')
 * @returns {function} - Express middleware
 */
const requestSizeLimit = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const limitInBytes = parseSize(limit);
      
      if (sizeInBytes > limitInBytes) {
        return res.status(413).json(
          generateErrorResponse(
            'Request entity too large',
            'VALIDATION_ERROR',
            { maxSize: limit }
          )
        );
      }
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 * @param {string} size - Size string (e.g., '10mb')
 * @returns {number} - Size in bytes
 */
const parseSize = (size) => {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return value * (units[unit] || 1);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestTimeout,
  apiLogger,
  requestId,
  securityHeaders,
  sanitizeRequest,
  validateContentType,
  requestSizeLimit
};