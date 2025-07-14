const jwt = require('jsonwebtoken');
const { logger, logSecurityEvent } = require('../utils/logger');
const { generateErrorResponse } = require('../utils/helpers');
const Customer = require('../models/Customer');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token for customer
 * @param {object} customer - Customer object
 * @returns {string} - JWT token
 */
const generateToken = (customer) => {
  try {
    const payload = {
      customerId: customer.id,
      customerUuid: customer.customerId,
      email: customer.email,
      status: customer.status,
      riskLevel: customer.riskLevel,
      type: 'customer'
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'boom-payment-gateway',
      audience: 'boom-customers'
    });

    logger.info(`JWT token generated for customer: ${customer.email}`);
    return token;
  } catch (error) {
    logger.error('JWT token generation failed:', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Generate JWT token for merchant/admin
 * @param {object} user - User object
 * @returns {string} - JWT token
 */
const generateMerchantToken = (user) => {
  try {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      merchantId: user.merchantId,
      type: 'merchant'
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'boom-payment-gateway',
      audience: 'boom-merchants'
    });

    logger.info(`JWT token generated for merchant: ${user.email}`);
    return token;
  } catch (error) {
    logger.error('JWT token generation failed:', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} - Decoded token payload
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'boom-payment-gateway'
    });
    return decoded;
  } catch (error) {
    logger.error('JWT token verification failed:', error);
    throw new Error('Invalid token');
  }
};

/**
 * Extract token from request
 * @param {object} req - Express request object
 * @returns {string|null} - Token or null
 */
const extractToken = (req) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check for token in query string (for webhooks)
    if (req.query.token) {
      return req.query.token;
    }
    
    // Check for token in cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }
    
    return null;
  } catch (error) {
    logger.error('Token extraction failed:', error);
    return null;
  }
};

/**
 * Authentication middleware
 * @param {boolean} required - Whether authentication is required
 * @returns {function} - Express middleware
 */
const authenticate = (required = true) => {
  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      
      if (!token) {
        if (required) {
          logSecurityEvent('authentication_failed', {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: 'No token provided'
          });
          
          return res.status(401).json(
            generateErrorResponse('Authentication required', 'AUTHENTICATION_ERROR')
          );
        } else {
          // Optional authentication
          req.user = null;
          return next();
        }
      }
      
      const decoded = verifyToken(token);
      
      // Check if token is expired
      if (decoded.exp * 1000 < Date.now()) {
        logSecurityEvent('authentication_failed', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: 'Token expired'
        });
        
        return res.status(401).json(
          generateErrorResponse('Token expired', 'AUTHENTICATION_ERROR')
        );
      }
      
      // Load full user data based on token type
      if (decoded.type === 'customer') {
        const customer = await Customer.findByPk(decoded.customerId);
        
        if (!customer) {
          logSecurityEvent('authentication_failed', {
            userId: decoded.customerId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: 'Customer not found'
          });
          
          return res.status(401).json(
            generateErrorResponse('Invalid token', 'AUTHENTICATION_ERROR')
          );
        }
        
        if (customer.status !== 'active') {
          logSecurityEvent('authentication_failed', {
            userId: decoded.customerId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: `Customer status: ${customer.status}`
          });
          
          return res.status(401).json(
            generateErrorResponse('Account inactive', 'AUTHENTICATION_ERROR')
          );
        }
        
        req.user = customer;
        req.userType = 'customer';
      } else if (decoded.type === 'merchant') {
        // For merchant/admin tokens (implementation would depend on your user system)
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          merchantId: decoded.merchantId
        };
        req.userType = 'merchant';
      } else {
        logSecurityEvent('authentication_failed', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: 'Invalid token type'
        });
        
        return res.status(401).json(
          generateErrorResponse('Invalid token', 'AUTHENTICATION_ERROR')
        );
      }
      
      // Add token info to request
      req.token = token;
      req.tokenData = decoded;
      
      logger.info(`User authenticated: ${req.user.email}`);
      next();
      
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      
      logSecurityEvent('authentication_error', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: error.message
      });
      
      return res.status(401).json(
        generateErrorResponse('Authentication failed', 'AUTHENTICATION_ERROR')
      );
    }
  };
};

/**
 * Authorization middleware - check user role/permissions
 * @param {string|array} allowedRoles - Allowed roles
 * @returns {function} - Express middleware
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json(
          generateErrorResponse('Authentication required', 'AUTHENTICATION_ERROR')
        );
      }
      
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      if (req.userType === 'customer') {
        // Customer authorization logic
        if (!rolesArray.includes('customer') && rolesArray.length > 0) {
          logSecurityEvent('authorization_failed', {
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: 'Customer not authorized for this resource'
          });
          
          return res.status(403).json(
            generateErrorResponse('Access denied', 'AUTHORIZATION_ERROR')
          );
        }
      } else if (req.userType === 'merchant') {
        // Merchant authorization logic
        if (!rolesArray.includes(req.user.role) && rolesArray.length > 0) {
          logSecurityEvent('authorization_failed', {
            userId: req.user.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: `Role ${req.user.role} not authorized`
          });
          
          return res.status(403).json(
            generateErrorResponse('Access denied', 'AUTHORIZATION_ERROR')
          );
        }
      }
      
      next();
    } catch (error) {
      logger.error('Authorization middleware error:', error);
      
      return res.status(500).json(
        generateErrorResponse('Authorization failed', 'AUTHORIZATION_ERROR')
      );
    }
  };
};

/**
 * Customer ownership middleware - ensure customer can only access their own data
 * @param {string} paramName - Parameter name containing customer ID
 * @returns {function} - Express middleware
 */
const requireCustomerOwnership = (paramName = 'customerId') => {
  return (req, res, next) => {
    try {
      if (!req.user || req.userType !== 'customer') {
        return res.status(401).json(
          generateErrorResponse('Customer authentication required', 'AUTHENTICATION_ERROR')
        );
      }
      
      const resourceCustomerId = req.params[paramName];
      
      if (resourceCustomerId && resourceCustomerId !== req.user.customerId) {
        logSecurityEvent('authorization_failed', {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: `Customer ${req.user.customerId} tried to access resource for ${resourceCustomerId}`
        });
        
        return res.status(403).json(
          generateErrorResponse('Access denied', 'AUTHORIZATION_ERROR')
        );
      }
      
      next();
    } catch (error) {
      logger.error('Customer ownership middleware error:', error);
      
      return res.status(500).json(
        generateErrorResponse('Authorization failed', 'AUTHORIZATION_ERROR')
      );
    }
  };
};

/**
 * API Key authentication middleware
 * @returns {function} - Express middleware
 */
const authenticateApiKey = () => {
  return (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      
      if (!apiKey) {
        return res.status(401).json(
          generateErrorResponse('API key required', 'AUTHENTICATION_ERROR')
        );
      }
      
      // In a real implementation, you would validate the API key against your database
      // For now, we'll use a simple check
      const validApiKeys = (process.env.API_KEYS || '').split(',').filter(key => key.trim());
      
      if (!validApiKeys.includes(apiKey)) {
        logSecurityEvent('api_key_invalid', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: 'Invalid API key provided'
        });
        
        return res.status(401).json(
          generateErrorResponse('Invalid API key', 'AUTHENTICATION_ERROR')
        );
      }
      
      // Add API key info to request
      req.apiKey = apiKey;
      req.authenticationType = 'api_key';
      
      next();
    } catch (error) {
      logger.error('API key authentication error:', error);
      
      return res.status(500).json(
        generateErrorResponse('Authentication failed', 'AUTHENTICATION_ERROR')
      );
    }
  };
};

/**
 * Webhook authentication middleware
 * @returns {function} - Express middleware
 */
const authenticateWebhook = () => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-webhook-signature'];
      const webhookSecret = process.env.WEBHOOK_SECRET;
      
      if (!signature || !webhookSecret) {
        return res.status(401).json(
          generateErrorResponse('Webhook authentication failed', 'AUTHENTICATION_ERROR')
        );
      }
      
      // Verify webhook signature
      const { verifyHmacSignature } = require('../utils/encryption');
      const payload = JSON.stringify(req.body);
      
      if (!verifyHmacSignature(payload, signature, webhookSecret)) {
        logSecurityEvent('webhook_authentication_failed', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: 'Invalid webhook signature'
        });
        
        return res.status(401).json(
          generateErrorResponse('Invalid webhook signature', 'AUTHENTICATION_ERROR')
        );
      }
      
      req.authenticationType = 'webhook';
      next();
    } catch (error) {
      logger.error('Webhook authentication error:', error);
      
      return res.status(500).json(
        generateErrorResponse('Webhook authentication failed', 'AUTHENTICATION_ERROR')
      );
    }
  };
};

module.exports = {
  generateToken,
  generateMerchantToken,
  verifyToken,
  extractToken,
  authenticate,
  authorize,
  requireCustomerOwnership,
  authenticateApiKey,
  authenticateWebhook
};