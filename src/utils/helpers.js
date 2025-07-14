const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { CURRENCIES, CURRENCY_SYMBOLS, AMOUNT_LIMITS } = require('../config/constants');
const { logger } = require('./logger');

/**
 * Generate a unique transaction ID
 * @returns {string} - Transaction ID
 */
const generateTransactionId = () => {
  try {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `txn_${timestamp}_${randomPart}`;
  } catch (error) {
    logger.error('Transaction ID generation failed:', error);
    return `txn_${uuidv4()}`;
  }
};

/**
 * Generate a unique customer ID
 * @returns {string} - Customer ID
 */
const generateCustomerId = () => {
  try {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `cus_${timestamp}_${randomPart}`;
  } catch (error) {
    logger.error('Customer ID generation failed:', error);
    return `cus_${uuidv4()}`;
  }
};

/**
 * Generate a unique refund ID
 * @returns {string} - Refund ID
 */
const generateRefundId = () => {
  try {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `ref_${timestamp}_${randomPart}`;
  } catch (error) {
    logger.error('Refund ID generation failed:', error);
    return `ref_${uuidv4()}`;
  }
};

/**
 * Generate a unique account ID
 * @returns {string} - Account ID
 */
const generateAccountId = () => {
  try {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `acc_${timestamp}_${randomPart}`;
  } catch (error) {
    logger.error('Account ID generation failed:', error);
    return `acc_${uuidv4()}`;
  }
};

/**
 * Generate a unique payout ID
 * @returns {string} - Payout ID
 */
const generatePayoutId = () => {
  try {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `payout_${timestamp}_${randomPart}`;
  } catch (error) {
    logger.error('Payout ID generation failed:', error);
    return `payout_${uuidv4()}`;
  }
};

/**
 * Convert amount to cents
 * @param {number} amount - Amount in dollars
 * @returns {number} - Amount in cents
 */
const toCents = (amount) => {
  try {
    if (!amount || typeof amount !== 'number') {
      return 0;
    }
    return Math.round(amount * 100);
  } catch (error) {
    logger.error('Amount conversion to cents failed:', error);
    return 0;
  }
};

/**
 * Convert cents to dollars
 * @param {number} cents - Amount in cents
 * @returns {number} - Amount in dollars
 */
const fromCents = (cents) => {
  try {
    if (!cents || typeof cents !== 'number') {
      return 0;
    }
    return cents / 100;
  } catch (error) {
    logger.error('Amount conversion from cents failed:', error);
    return 0;
  }
};

/**
 * Format amount for display
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code
 * @returns {string} - Formatted amount
 */
const formatAmount = (amount, currency = 'USD') => {
  try {
    const dollarAmount = fromCents(amount);
    const symbol = CURRENCY_SYMBOLS[currency] || '$';
    
    return `${symbol}${dollarAmount.toFixed(2)}`;
  } catch (error) {
    logger.error('Amount formatting failed:', error);
    return '$0.00';
  }
};

/**
 * Validate amount
 * @param {number} amount - Amount to validate (in cents)
 * @returns {object} - Validation result
 */
const validateAmount = (amount) => {
  try {
    const result = {
      isValid: true,
      errors: []
    };

    if (!amount || typeof amount !== 'number') {
      result.isValid = false;
      result.errors.push('Amount is required');
      return result;
    }

    if (amount < AMOUNT_LIMITS.MIN) {
      result.isValid = false;
      result.errors.push(`Amount must be at least ${formatAmount(AMOUNT_LIMITS.MIN)}`);
    }

    if (amount > AMOUNT_LIMITS.MAX) {
      result.isValid = false;
      result.errors.push(`Amount must be less than ${formatAmount(AMOUNT_LIMITS.MAX)}`);
    }

    if (amount !== Math.round(amount)) {
      result.isValid = false;
      result.errors.push('Amount must be a whole number of cents');
    }

    return result;
  } catch (error) {
    logger.error('Amount validation failed:', error);
    return {
      isValid: false,
      errors: ['Amount validation failed']
    };
  }
};

/**
 * Validate currency
 * @param {string} currency - Currency code
 * @returns {boolean} - True if valid
 */
const validateCurrency = (currency) => {
  try {
    if (!currency || typeof currency !== 'string') {
      return false;
    }

    return Object.values(CURRENCIES).includes(currency.toUpperCase());
  } catch (error) {
    logger.error('Currency validation failed:', error);
    return false;
  }
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
const formatDate = (date) => {
  try {
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  } catch (error) {
    logger.error('Date formatting failed:', error);
    return 'Invalid Date';
  }
};

/**
 * Get relative time
 * @param {Date|string} date - Date to format
 * @returns {string} - Relative time
 */
const getRelativeTime = (date) => {
  try {
    return moment(date).fromNow();
  } catch (error) {
    logger.error('Relative time calculation failed:', error);
    return 'Unknown';
  }
};

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
const validateEmail = (email) => {
  try {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  } catch (error) {
    logger.error('Email validation failed:', error);
    return false;
  }
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid
 */
const validatePhone = (phone) => {
  try {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    // Remove all non-digit characters except + at the beginning
    const cleanPhone = phone.replace(/[^+0-9]/g, '');
    
    // Check if it starts with + and has at least 10 digits total
    if (cleanPhone.startsWith('+')) {
      // International format: +1234567890 (minimum 10 digits after +)
      return cleanPhone.length >= 11 && cleanPhone.length <= 16;
    } else {
      // National format: 1234567890 (minimum 10 digits)
      return cleanPhone.length >= 10 && cleanPhone.length <= 15;
    }
  } catch (error) {
    logger.error('Phone validation failed:', error);
    return false;
  }
};

/**
 * Sanitize input for SQL queries
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
const sanitizeInput = (input) => {
  try {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove potentially dangerous characters
    return input.replace(/[<>\"'%;)(&+]/g, '');
  } catch (error) {
    logger.error('Input sanitization failed:', error);
    return '';
  }
};

/**
 * Generate pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {object} - Pagination metadata
 */
const generatePaginationMeta = (page, limit, total) => {
  try {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null
    };
  } catch (error) {
    logger.error('Pagination metadata generation failed:', error);
    return {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
      nextPage: null,
      prevPage: null
    };
  }
};

/**
 * Generate API response
 * @param {boolean} success - Success status
 * @param {*} data - Response data
 * @param {string} message - Response message
 * @param {*} meta - Additional metadata
 * @returns {object} - API response
 */
const generateApiResponse = (success, data = null, message = '', meta = null) => {
  try {
    const response = {
      success,
      timestamp: new Date().toISOString(),
      data,
      message
    };

    if (meta) {
      response.meta = meta;
    }

    return response;
  } catch (error) {
    logger.error('API response generation failed:', error);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      data: null,
      message: 'Internal server error'
    };
  }
};

/**
 * Generate error response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {*} details - Error details
 * @returns {object} - Error response
 */
const generateErrorResponse = (message, code = 'INTERNAL_ERROR', details = null) => {
  try {
    const response = {
      success: false,
      error: {
        message,
        code,
        timestamp: new Date().toISOString()
      }
    };

    if (details) {
      response.error.details = details;
    }

    return response;
  } catch (error) {
    logger.error('Error response generation failed:', error);
    return {
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      }
    };
  }
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with function result
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  try {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, i);
        logger.warn(`Retry ${i + 1}/${maxRetries} failed, waiting ${delay}ms:`, error.message);
        await sleep(delay);
      }
    }
  } catch (error) {
    logger.error('Retry with backoff failed:', error);
    throw error;
  }
};

/**
 * Calculate risk score based on transaction details
 * @param {object} transactionData - Transaction data
 * @returns {object} - Risk assessment
 */
const calculateRiskScore = (transactionData) => {
  try {
    const {
      amount,
      cvvProvided,
      cardType,
      customerHistory,
      ipAddress,
      deviceFingerprint
    } = transactionData;

    let score = 0;
    const factors = [];

    // Amount-based risk
    if (amount > 50000) { // $500+
      score += 30;
      factors.push('High amount');
    } else if (amount > 10000) { // $100+
      score += 10;
      factors.push('Medium amount');
    }

    // CVV-based risk
    if (!cvvProvided) {
      score += 25;
      factors.push('No CVV provided');
    }

    // Card type risk
    if (cardType === 'unknown') {
      score += 20;
      factors.push('Unknown card type');
    }

    // Customer history risk
    if (!customerHistory || customerHistory.totalTransactions === 0) {
      score += 15;
      factors.push('New customer');
    }

    // Time-based risk (example: late night transactions)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 10;
      factors.push('Unusual hour');
    }

    // Determine risk level
    let riskLevel = 'low';
    if (score >= 70) {
      riskLevel = 'very_high';
    } else if (score >= 50) {
      riskLevel = 'high';
    } else if (score >= 30) {
      riskLevel = 'medium';
    }

    return {
      score,
      level: riskLevel,
      factors
    };
  } catch (error) {
    logger.error('Risk score calculation failed:', error);
    return {
      score: 100,
      level: 'very_high',
      factors: ['Risk calculation failed']
    };
  }
};

module.exports = {
  generateTransactionId,
  generateCustomerId,
  generateRefundId,
  generateAccountId,
  generatePayoutId,
  toCents,
  fromCents,
  formatAmount,
  validateAmount,
  validateCurrency,
  formatDate,
  getRelativeTime,
  validateEmail,
  validatePhone,
  sanitizeInput,
  generatePaginationMeta,
  generateApiResponse,
  generateErrorResponse,
  sleep,
  retryWithBackoff,
  calculateRiskScore
};