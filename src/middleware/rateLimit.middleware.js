const rateLimit = require('express-rate-limit');
const { logger, logSecurityEvent } = require('../utils/logger');
const { generateErrorResponse } = require('../utils/helpers');

/**
 * Create rate limiter with custom configuration
 * @param {object} options - Rate limit options
 * @returns {function} - Express middleware
 */
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => {
      // Use IP address as default key
      return req.ip;
    },
    handler: (req, res) => {
      logSecurityEvent('rate_limit_exceeded', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: `Rate limit exceeded: ${req.method} ${req.originalUrl}`
      });

      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);

      return res.status(429).json(
        generateErrorResponse(
          'Too many requests, please try again later',
          'RATE_LIMIT_EXCEEDED',
          {
            retryAfter: Math.ceil(options.windowMs / 1000) || 900
          }
        )
      );
    },
    onLimitReached: (req, res) => {
      logger.warn(`Rate limit reached for IP: ${req.ip}`);
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * General API rate limiter
 */
const generalRateLimit = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per window
  skipSuccessfulRequests: true, // don't count successful requests
  message: 'Too many login attempts, please try again later'
});

/**
 * Payment processing rate limiter
 */
const paymentRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 payment attempts per minute
  message: 'Too many payment attempts, please try again later',
  keyGenerator: (req) => {
    // Use customer ID if available, otherwise IP
    if (req.user && req.user.customerId) {
      return `customer_${req.user.customerId}`;
    }
    return req.ip;
  }
});

/**
 * High-value transaction rate limiter
 */
const highValueRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit to 3 high-value transactions per 5 minutes
  message: 'Too many high-value transactions, please try again later',
  keyGenerator: (req) => {
    if (req.user && req.user.customerId) {
      return `high_value_${req.user.customerId}`;
    }
    return `high_value_${req.ip}`;
  }
});

/**
 * Refund processing rate limiter
 */
const refundRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each user to 5 refund requests per 10 minutes
  message: 'Too many refund requests, please try again later',
  keyGenerator: (req) => {
    if (req.user && req.user.customerId) {
      return `refund_${req.user.customerId}`;
    }
    return `refund_${req.ip}`;
  }
});

/**
 * Card validation rate limiter
 */
const cardValidationRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit card validation attempts
  message: 'Too many card validation attempts, please try again later'
});

/**
 * Customer creation rate limiter
 */
const customerCreationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 customer creations per hour
  message: 'Too many account creation attempts, please try again later'
});

/**
 * Webhook rate limiter
 */
const webhookRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // allow many webhook calls
  message: 'Too many webhook requests'
});

/**
 * Progressive rate limiting middleware
 * Implements escalating penalties for repeated violations
 */
const progressiveRateLimit = () => {
  const violations = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    // Clean up old violations
    const cutoff = now - windowMs;
    for (const [ip, data] of violations.entries()) {
      if (data.lastViolation < cutoff) {
        violations.delete(ip);
      }
    }
    
    const violation = violations.get(key);
    
    if (violation) {
      const timeSinceLastViolation = now - violation.lastViolation;
      
      // If within penalty period, block request
      if (timeSinceLastViolation < violation.penaltyMs) {
        logSecurityEvent('progressive_rate_limit_block', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: `Blocked due to ${violation.count} violations, penalty: ${violation.penaltyMs}ms`
        });
        
        return res.status(429).json(
          generateErrorResponse(
            'Access temporarily blocked due to repeated violations',
            'RATE_LIMIT_EXCEEDED',
            {
              retryAfter: Math.ceil(violation.penaltyMs / 1000),
              violationCount: violation.count
            }
          )
        );
      }
    }
    
    // Store original res.status to detect rate limit responses
    const originalStatus = res.status;
    let statusCode = 200;
    
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    // Check if this was a rate limit violation after response
    res.on('finish', () => {
      if (statusCode === 429) {
        const currentViolation = violations.get(key) || { count: 0, lastViolation: 0 };
        
        currentViolation.count++;
        currentViolation.lastViolation = now;
        
        // Progressive penalty: 1 min, 5 min, 15 min, 1 hour, 24 hours
        const penaltyLevels = [60000, 300000, 900000, 3600000, 86400000];
        const penaltyIndex = Math.min(currentViolation.count - 1, penaltyLevels.length - 1);
        currentViolation.penaltyMs = penaltyLevels[penaltyIndex];
        
        violations.set(key, currentViolation);
        
        logSecurityEvent('progressive_rate_limit_violation', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: `Violation ${currentViolation.count}, penalty: ${currentViolation.penaltyMs}ms`
        });
      }
    });
    
    next();
  };
};

/**
 * Dynamic rate limiting based on user risk level
 */
const dynamicRateLimit = (baseOptions = {}) => {
  return (req, res, next) => {
    let multiplier = 1;
    
    // Adjust rate limit based on user risk level
    if (req.user && req.user.riskLevel) {
      switch (req.user.riskLevel) {
        case 'low':
          multiplier = 2; // Allow double the requests
          break;
        case 'medium':
          multiplier = 1; // Standard rate
          break;
        case 'high':
          multiplier = 0.5; // Half the requests
          break;
        case 'very_high':
          multiplier = 0.25; // Quarter the requests
          break;
      }
    }
    
    // Adjust for authentication status
    if (!req.user) {
      multiplier *= 0.5; // Unauthenticated users get half the rate
    }
    
    const adjustedOptions = {
      ...baseOptions,
      max: Math.max(1, Math.floor((baseOptions.max || 100) * multiplier))
    };
    
    const limiter = createRateLimiter(adjustedOptions);
    return limiter(req, res, next);
  };
};

/**
 * Rate limiting for failed payment attempts
 */
const failedPaymentRateLimit = () => {
  const failedAttempts = new Map();
  
  return (req, res, next) => {
    const key = req.user ? `customer_${req.user.customerId}` : req.ip;
    const now = Date.now();
    const windowMs = 30 * 60 * 1000; // 30 minutes
    
    // Clean up old attempts
    const cutoff = now - windowMs;
    for (const [id, attempts] of failedAttempts.entries()) {
      failedAttempts.set(id, attempts.filter(time => time > cutoff));
      if (failedAttempts.get(id).length === 0) {
        failedAttempts.delete(id);
      }
    }
    
    const attempts = failedAttempts.get(key) || [];
    
    // Block if too many failed attempts
    if (attempts.length >= 5) {
      logSecurityEvent('failed_payment_rate_limit', {
        userId: req.user ? req.user.customerId : null,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: `${attempts.length} failed payment attempts in last 30 minutes`
      });
      
      return res.status(429).json(
        generateErrorResponse(
          'Too many failed payment attempts, please try again later',
          'RATE_LIMIT_EXCEEDED',
          {
            retryAfter: 1800 // 30 minutes
          }
        )
      );
    }
    
    // Store original res.status to detect failed payments
    const originalStatus = res.status;
    let statusCode = 200;
    
    res.status = function(code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };
    
    // Track failed attempts
    res.on('finish', () => {
      if (statusCode >= 400) {
        attempts.push(now);
        failedAttempts.set(key, attempts);
      }
    });
    
    next();
  };
};

/**
 * Whitelist middleware - bypass rate limiting for trusted IPs
 */
const whitelist = (trustedIPs = []) => {
  const trustedIPSet = new Set(trustedIPs);
  
  return (req, res, next) => {
    if (trustedIPSet.has(req.ip)) {
      // Skip rate limiting for trusted IPs
      return next();
    }
    
    // Continue with rate limiting
    return generalRateLimit(req, res, next);
  };
};

module.exports = {
  createRateLimiter,
  generalRateLimit,
  authRateLimit,
  paymentRateLimit,
  highValueRateLimit,
  refundRateLimit,
  cardValidationRateLimit,
  customerCreationRateLimit,
  webhookRateLimit,
  progressiveRateLimit,
  dynamicRateLimit,
  failedPaymentRateLimit,
  whitelist
};