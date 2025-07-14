const Joi = require('joi');
const { logger } = require('../utils/logger');
const { generateErrorResponse } = require('../utils/helpers');

/**
 * Validation middleware factory
 * @param {object} schema - Joi validation schema
 * @param {string} target - Target to validate ('body', 'params', 'query', 'headers')
 * @returns {function} - Express middleware
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    try {
      const dataToValidate = req[target];
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        logger.warn('Validation error:', {
          target,
          errors: errorDetails,
          originalData: dataToValidate
        });

        return res.status(400).json(
          generateErrorResponse(
            'Validation failed',
            'VALIDATION_ERROR',
            { errors: errorDetails }
          )
        );
      }

      // Replace the original data with validated and sanitized data
      req[target] = value;
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      return res.status(500).json(
        generateErrorResponse('Validation failed', 'VALIDATION_ERROR')
      );
    }
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // Customer schemas
  createCustomer: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    address: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    country: Joi.string().length(2).default('US').optional(),
    password: Joi.string().min(8).max(128).optional()
  }),

  updateCustomer: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    address: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    country: Joi.string().length(2).optional()
  }),

  // Payment method schemas
  createPaymentMethod: Joi.object({
    cardNumber: Joi.string().pattern(/^[0-9]{13,19}$/).required(),
    expiryDate: Joi.string().pattern(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/).required(),
    cvv: Joi.string().pattern(/^[0-9]{3,4}$/).optional(),
    cardholderName: Joi.string().min(2).max(100).required(),
    billingAddress: Joi.string().max(200).optional(),
    billingCity: Joi.string().max(100).optional(),
    billingState: Joi.string().max(100).optional(),
    billingZipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    billingCountry: Joi.string().length(2).default('US').optional(),
    isDefault: Joi.boolean().default(false).optional()
  }),

  // Payment processing schemas
  processPayment: Joi.object({
    customerId: Joi.string().optional(),
    paymentMethodId: Joi.string().optional(),
    cardToken: Joi.string().optional(),
    cardData: Joi.object({
      cardNumber: Joi.string().pattern(/^[0-9]{13,19}$/).required(),
      expiryDate: Joi.string().pattern(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/).required(),
      cvv: Joi.string().pattern(/^[0-9]{3,4}$/).optional(),
      cardholderName: Joi.string().min(2).max(100).required()
    }).optional(),
    amount: Joi.number().positive().precision(2).min(0.01).max(999999.99).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').default('USD').optional(),
    description: Joi.string().max(200).optional(),
    orderId: Joi.string().max(100).optional(),
    merchantId: Joi.string().max(100).optional(),
    customerInfo: Joi.object({
      email: Joi.string().email().optional(),
      firstName: Joi.string().min(2).max(50).optional(),
      lastName: Joi.string().min(2).max(50).optional(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
    }).optional(),
    billingAddress: Joi.object({
      address: Joi.string().max(200).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      country: Joi.string().length(2).default('US').optional()
    }).optional(),
    shippingAddress: Joi.object({
      address: Joi.string().max(200).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      country: Joi.string().length(2).default('US').optional()
    }).optional(),
    metadata: Joi.object().optional()
  }).custom((value, helpers) => {
    // Ensure either customerId+paymentMethodId, cardToken, or cardData is provided
    const hasCustomerAndPaymentMethod = value.customerId && value.paymentMethodId;
    const hasCardToken = value.cardToken;
    const hasCardData = value.cardData;
    
    if (!hasCustomerAndPaymentMethod && !hasCardToken && !hasCardData) {
      return helpers.error('custom.paymentMethodRequired');
    }
    
    return value;
  }, 'Payment method validation').messages({
    'custom.paymentMethodRequired': 'Either customerId+paymentMethodId, cardToken, or cardData must be provided'
  }),

  // Refund schemas
  createRefund: Joi.object({
    transactionId: Joi.string().required(),
    amount: Joi.number().positive().precision(2).min(0.01).optional(),
    reason: Joi.string().valid(
      'customer_request',
      'duplicate_transaction',
      'fraudulent_transaction',
      'processing_error',
      'merchant_error',
      'chargeback',
      'other'
    ).default('customer_request').optional(),
    description: Joi.string().max(500).optional()
  }),

  // Authentication schemas
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    agreeToTerms: Joi.boolean().valid(true).required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().required()
  }).custom((value, helpers) => {
    if (value.newPassword !== value.confirmPassword) {
      return helpers.error('custom.passwordMismatch');
    }
    return value;
  }, 'Password confirmation').messages({
    'custom.passwordMismatch': 'New password and confirm password must match'
  }),

  // Query parameter schemas
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
  }),

  transactionQuery: Joi.object({
    status: Joi.string().valid(
      'pending',
      'processing',
      'completed',
      'failed',
      'refunded',
      'partially_refunded',
      'cancelled'
    ).optional(),
    riskLevel: Joi.string().valid('low', 'medium', 'high', 'very_high').optional(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').optional(),
    minAmount: Joi.number().positive().precision(2).optional(),
    maxAmount: Joi.number().positive().precision(2).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    merchantId: Joi.string().optional(),
    cvvProvided: Joi.boolean().optional()
  }).concat(Joi.object({
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
  })),

  // Parameter schemas
  uuidParam: Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required()
  }),

  customerIdParam: Joi.object({
    customerId: Joi.string().required()
  }),

  transactionIdParam: Joi.object({
    transactionId: Joi.string().required()
  }),

  refundIdParam: Joi.object({
    refundId: Joi.string().required()
  }),

  // Webhook schemas
  webhook: Joi.object({
    event: Joi.string().valid(
      'payment.completed',
      'payment.failed',
      'payment.refunded',
      'customer.created',
      'transaction.updated'
    ).required(),
    data: Joi.object().required(),
    timestamp: Joi.date().iso().required(),
    signature: Joi.string().required()
  })
};

/**
 * Validate pagination parameters
 */
const validatePagination = validate(schemas.paginationQuery, 'query');

/**
 * Validate UUID parameter
 */
const validateUuidParam = validate(schemas.uuidParam, 'params');

/**
 * Validate customer ID parameter
 */
const validateCustomerIdParam = validate(schemas.customerIdParam, 'params');

/**
 * Validate transaction ID parameter
 */
const validateTransactionIdParam = validate(schemas.transactionIdParam, 'params');

/**
 * Validate refund ID parameter
 */
const validateRefundIdParam = validate(schemas.refundIdParam, 'params');

/**
 * Custom validation helpers
 */
const customValidators = {
  // Validate card number using Luhn algorithm
  cardNumber: (value, helpers) => {
    const { validateCardNumber } = require('../utils/cardValidator');
    if (!validateCardNumber(value)) {
      return helpers.error('custom.invalidCardNumber');
    }
    return value;
  },

  // Validate expiry date
  expiryDate: (value, helpers) => {
    const { validateExpiryDate } = require('../utils/cardValidator');
    if (!validateExpiryDate(value)) {
      return helpers.error('custom.invalidExpiryDate');
    }
    return value;
  },

  // Validate CVV based on card type
  cvv: (value, helpers) => {
    const { validateCvv, detectCardType } = require('../utils/cardValidator');
    const cardNumber = helpers.state.ancestors[0].cardNumber;
    
    if (cardNumber && value) {
      const cardType = detectCardType(cardNumber);
      if (!validateCvv(value, cardType)) {
        return helpers.error('custom.invalidCvv');
      }
    }
    return value;
  }
};

// Add custom validation messages
const customMessages = {
  'custom.invalidCardNumber': 'Invalid card number',
  'custom.invalidExpiryDate': 'Invalid or expired card expiry date',
  'custom.invalidCvv': 'Invalid CVV for card type'
};

/**
 * Create enhanced validation schema with custom validators
 */
const createEnhancedPaymentSchema = () => {
  return schemas.processPayment.custom((value, helpers) => {
    if (value.cardData) {
      // Validate card data with custom validators
      const cardNumber = value.cardData.cardNumber;
      const expiryDate = value.cardData.expiryDate;
      const cvv = value.cardData.cvv;

      if (!customValidators.cardNumber(cardNumber, helpers)) {
        return helpers.error('custom.invalidCardNumber');
      }

      if (!customValidators.expiryDate(expiryDate, helpers)) {
        return helpers.error('custom.invalidExpiryDate');
      }

      if (cvv && !customValidators.cvv(cvv, { state: { ancestors: [value.cardData] } })) {
        return helpers.error('custom.invalidCvv');
      }
    }

    return value;
  }, 'Enhanced payment validation').messages(customMessages);
};

module.exports = {
  validate,
  schemas,
  validatePagination,
  validateUuidParam,
  validateCustomerIdParam,
  validateTransactionIdParam,
  validateRefundIdParam,
  customValidators,
  customMessages,
  createEnhancedPaymentSchema
};