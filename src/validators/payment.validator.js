const Joi = require('joi');
const { validateCardNumber, validateExpiryDate, validateCvv, detectCardType } = require('../utils/cardValidator');

// Custom validation functions
const customValidations = {
  cardNumber: (value, helpers) => {
    if (!validateCardNumber(value)) {
      return helpers.error('payment.invalidCardNumber');
    }
    return value;
  },
  
  expiryDate: (value, helpers) => {
    if (!validateExpiryDate(value)) {
      return helpers.error('payment.invalidExpiryDate');
    }
    return value;
  },
  
  cvv: (value, helpers) => {
    const cardNumber = helpers.state.ancestors[0].cardNumber;
    if (cardNumber && value) {
      const cardType = detectCardType(cardNumber);
      if (!validateCvv(value, cardType)) {
        return helpers.error('payment.invalidCvv');
      }
    }
    return value;
  }
};

// Payment validation schemas
const paymentValidators = {
  // Process payment validation
  processPayment: Joi.object({
    // Payment method identification (one of these is required)
    customerId: Joi.string().optional(),
    paymentMethodId: Joi.string().optional(),
    cardToken: Joi.string().optional(),
    cardData: Joi.object({
      cardNumber: Joi.string()
        .pattern(/^[0-9]{13,19}$/)
        .custom(customValidations.cardNumber)
        .required(),
      expiryDate: Joi.string()
        .pattern(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/)
        .custom(customValidations.expiryDate)
        .required(),
      cvv: Joi.string()
        .pattern(/^[0-9]{3,4}$/)
        .custom(customValidations.cvv)
        .optional(),
      cardholderName: Joi.string().min(2).max(100).required()
    }).optional(),
    
    // Transaction details
    amount: Joi.number()
      .positive()
      .precision(2)
      .min(0.01)
      .max(999999.99)
      .required(),
    currency: Joi.string()
      .valid('USD', 'EUR', 'GBP', 'CAD')
      .default('USD')
      .optional(),
    description: Joi.string().max(500).optional(),
    orderId: Joi.string().max(100).optional(),
    
    // Merchant information
    merchantId: Joi.string().max(100).optional(),
    merchantName: Joi.string().max(200).optional(),
    
    // Customer information (for guest payments)
    customerInfo: Joi.object({
      email: Joi.string().email().optional(),
      firstName: Joi.string().min(2).max(50).optional(),
      lastName: Joi.string().min(2).max(50).optional(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
    }).optional(),
    
    // Billing address
    billingAddress: Joi.object({
      address: Joi.string().max(200).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      country: Joi.string().length(2).default('US').optional()
    }).optional(),
    
    // Shipping address
    shippingAddress: Joi.object({
      address: Joi.string().max(200).optional(),
      city: Joi.string().max(100).optional(),
      state: Joi.string().max(100).optional(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      country: Joi.string().length(2).default('US').optional()
    }).optional(),
    
    // Additional data
    metadata: Joi.object().optional(),
    
    // Risk assessment flags
    allowHighRisk: Joi.boolean().default(false).optional(),
    requireCvv: Joi.boolean().default(false).optional()
  }).custom((value, helpers) => {
    // Ensure at least one payment method is provided
    const hasCustomerAndPaymentMethod = value.customerId && value.paymentMethodId;
    const hasCardToken = value.cardToken;
    const hasCardData = value.cardData;
    
    if (!hasCustomerAndPaymentMethod && !hasCardToken && !hasCardData) {
      return helpers.error('payment.paymentMethodRequired');
    }
    
    // If requireCvv is true, ensure CVV is provided
    if (value.requireCvv && value.cardData && !value.cardData.cvv) {
      return helpers.error('payment.cvvRequired');
    }
    
    return value;
  }),

  // Tokenize card validation
  tokenizeCard: Joi.object({
    cardNumber: Joi.string()
      .pattern(/^[0-9]{13,19}$/)
      .custom(customValidations.cardNumber)
      .required(),
    expiryDate: Joi.string()
      .pattern(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/)
      .custom(customValidations.expiryDate)
      .required(),
    cvv: Joi.string()
      .pattern(/^[0-9]{3,4}$/)
      .custom(customValidations.cvv)
      .optional(),
    cardholderName: Joi.string().min(2).max(100).required(),
    customerId: Joi.string().optional(),
    saveCard: Joi.boolean().default(false).optional()
  }),

  // Validate card validation
  validateCard: Joi.object({
    cardNumber: Joi.string()
      .pattern(/^[0-9]{13,19}$/)
      .custom(customValidations.cardNumber)
      .required(),
    expiryDate: Joi.string()
      .pattern(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/)
      .custom(customValidations.expiryDate)
      .required(),
    cvv: Joi.string()
      .pattern(/^[0-9]{3,4}$/)
      .custom(customValidations.cvv)
      .optional(),
    cardholderName: Joi.string().min(2).max(100).required()
  }),

  // Refund validation
  createRefund: Joi.object({
    transactionId: Joi.string().required(),
    amount: Joi.number()
      .positive()
      .precision(2)
      .min(0.01)
      .optional(), // If not provided, full refund
    reason: Joi.string().valid(
      'customer_request',
      'duplicate_transaction',
      'fraudulent_transaction',
      'processing_error',
      'merchant_error',
      'chargeback',
      'other'
    ).default('customer_request').optional(),
    description: Joi.string().max(1000).optional(),
    notifyCustomer: Joi.boolean().default(true).optional()
  }),

  // Approve refund validation
  approveRefund: Joi.object({
    refundId: Joi.string().required(),
    approvedBy: Joi.string().required(),
    notes: Joi.string().max(1000).optional()
  }),

  // Transaction query validation
  transactionQuery: Joi.object({
    customerId: Joi.string().optional(),
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
    cvvProvided: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    sortBy: Joi.string().valid('createdAt', 'amount', 'status').default('createdAt').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
  }).custom((value, helpers) => {
    // Ensure end date is after start date
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      return helpers.error('payment.invalidDateRange');
    }
    
    // Ensure min amount is less than max amount
    if (value.minAmount && value.maxAmount && value.minAmount >= value.maxAmount) {
      return helpers.error('payment.invalidAmountRange');
    }
    
    return value;
  })
};

// Custom error messages
const errorMessages = {
  'payment.invalidCardNumber': 'Invalid card number',
  'payment.invalidExpiryDate': 'Invalid or expired card expiry date',
  'payment.invalidCvv': 'Invalid CVV for card type',
  'payment.paymentMethodRequired': 'Payment method is required (customerId+paymentMethodId, cardToken, or cardData)',
  'payment.cvvRequired': 'CVV is required for this transaction',
  'payment.invalidDateRange': 'End date must be after start date',
  'payment.invalidAmountRange': 'Maximum amount must be greater than minimum amount'
};

module.exports = {
  paymentValidators,
  customValidations,
  errorMessages
};