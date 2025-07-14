const Joi = require('joi');

// Customer validation schemas
const customerValidators = {
  // Create customer validation
  createCustomer: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    
    // Address information
    address: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    country: Joi.string().length(2).default('US').optional(),
    
    // Authentication (if creating account)
    password: Joi.string().min(8).max(128).optional(),
    confirmPassword: Joi.string().optional(),
    
    // Terms and conditions
    agreeToTerms: Joi.boolean().valid(true).optional(),
    
    // Additional metadata
    metadata: Joi.object().optional()
  }).custom((value, helpers) => {
    // If password is provided, confirm password must match
    if (value.password && value.confirmPassword && value.password !== value.confirmPassword) {
      return helpers.error('customer.passwordMismatch');
    }
    
    // If password is provided, terms must be agreed
    if (value.password && !value.agreeToTerms) {
      return helpers.error('customer.termsRequired');
    }
    
    return value;
  }),

  // Update customer validation
  updateCustomer: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    
    // Address information
    address: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    country: Joi.string().length(2).optional(),
    
    // Additional metadata
    metadata: Joi.object().optional()
  }),

  // Customer query validation
  customerQuery: Joi.object({
    email: Joi.string().email().optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'blocked').optional(),
    riskLevel: Joi.string().valid('low', 'medium', 'high', 'very_high').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    minTransactions: Joi.number().integer().min(0).optional(),
    maxTransactions: Joi.number().integer().min(0).optional(),
    minAmount: Joi.number().positive().precision(2).optional(),
    maxAmount: Joi.number().positive().precision(2).optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    sortBy: Joi.string().valid('createdAt', 'email', 'firstName', 'lastName', 'totalAmount', 'totalTransactions').default('createdAt').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
  }).custom((value, helpers) => {
    // Ensure end date is after start date
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      return helpers.error('customer.invalidDateRange');
    }
    
    // Ensure min values are less than max values
    if (value.minTransactions && value.maxTransactions && value.minTransactions >= value.maxTransactions) {
      return helpers.error('customer.invalidTransactionRange');
    }
    
    if (value.minAmount && value.maxAmount && value.minAmount >= value.maxAmount) {
      return helpers.error('customer.invalidAmountRange');
    }
    
    return value;
  }),

  // Update customer status validation
  updateCustomerStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'suspended', 'blocked').required(),
    reason: Joi.string().max(500).optional(),
    notifyCustomer: Joi.boolean().default(true).optional()
  }),

  // Update customer risk level validation
  updateCustomerRiskLevel: Joi.object({
    riskLevel: Joi.string().valid('low', 'medium', 'high', 'very_high').required(),
    reason: Joi.string().max(500).optional(),
    reviewedBy: Joi.string().required()
  }),

  // Add payment method validation
  addPaymentMethod: Joi.object({
    cardNumber: Joi.string().pattern(/^[0-9]{13,19}$/).required(),
    expiryDate: Joi.string().pattern(/^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$/).required(),
    cvv: Joi.string().pattern(/^[0-9]{3,4}$/).optional(),
    cardholderName: Joi.string().min(2).max(100).required(),
    
    // Billing address
    billingAddress: Joi.string().max(200).optional(),
    billingCity: Joi.string().max(100).optional(),
    billingState: Joi.string().max(100).optional(),
    billingZipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    billingCountry: Joi.string().length(2).default('US').optional(),
    
    // Settings
    isDefault: Joi.boolean().default(false).optional(),
    nickname: Joi.string().max(50).optional()
  }),

  // Update payment method validation
  updatePaymentMethod: Joi.object({
    cardholderName: Joi.string().min(2).max(100).optional(),
    
    // Billing address
    billingAddress: Joi.string().max(200).optional(),
    billingCity: Joi.string().max(100).optional(),
    billingState: Joi.string().max(100).optional(),
    billingZipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
    billingCountry: Joi.string().length(2).optional(),
    
    // Settings
    isDefault: Joi.boolean().optional(),
    nickname: Joi.string().max(50).optional()
  }),

  // Customer search validation
  customerSearch: Joi.object({
    query: Joi.string().min(2).max(100).required(),
    searchBy: Joi.string().valid('email', 'name', 'phone', 'customerId').default('email').optional(),
    exactMatch: Joi.boolean().default(false).optional(),
    includeInactive: Joi.boolean().default(false).optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(50).default(20).optional()
  }),

  // Customer analytics validation
  customerAnalytics: Joi.object({
    customerId: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    groupBy: Joi.string().valid('day', 'week', 'month', 'year').default('day').optional(),
    metrics: Joi.array().items(
      Joi.string().valid('transactions', 'amount', 'success_rate', 'avg_amount', 'refunds')
    ).default(['transactions', 'amount']).optional()
  }).custom((value, helpers) => {
    // Ensure end date is after start date
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      return helpers.error('customer.invalidDateRange');
    }
    
    // Default date range if not provided (last 30 days)
    if (!value.startDate && !value.endDate) {
      const now = new Date();
      value.endDate = now;
      value.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return value;
  }),

  // Customer transaction history validation
  customerTransactionHistory: Joi.object({
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
    paymentMethodId: Joi.string().optional(),
    merchantId: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    sortBy: Joi.string().valid('createdAt', 'amount', 'status').default('createdAt').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
  }).custom((value, helpers) => {
    // Ensure end date is after start date
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      return helpers.error('customer.invalidDateRange');
    }
    
    // Ensure min amount is less than max amount
    if (value.minAmount && value.maxAmount && value.minAmount >= value.maxAmount) {
      return helpers.error('customer.invalidAmountRange');
    }
    
    return value;
  }),

  // Customer export validation
  customerExport: Joi.object({
    format: Joi.string().valid('csv', 'json', 'xlsx').default('csv').optional(),
    fields: Joi.array().items(
      Joi.string().valid(
        'customerId',
        'email',
        'firstName',
        'lastName',
        'phone',
        'address',
        'city',
        'state',
        'zipCode',
        'country',
        'status',
        'riskLevel',
        'totalTransactions',
        'totalAmount',
        'successfulTransactions',
        'failedTransactions',
        'createdAt',
        'lastTransactionDate'
      )
    ).default([
      'customerId',
      'email',
      'firstName',
      'lastName',
      'status',
      'totalTransactions',
      'totalAmount',
      'createdAt'
    ]).optional(),
    filters: Joi.object({
      status: Joi.string().valid('active', 'inactive', 'suspended', 'blocked').optional(),
      riskLevel: Joi.string().valid('low', 'medium', 'high', 'very_high').optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional(),
      minTransactions: Joi.number().integer().min(0).optional(),
      maxTransactions: Joi.number().integer().min(0).optional()
    }).optional()
  })
};

// Custom error messages
const errorMessages = {
  'customer.passwordMismatch': 'Password and confirm password must match',
  'customer.termsRequired': 'Terms and conditions must be agreed to create account',
  'customer.invalidDateRange': 'End date must be after start date',
  'customer.invalidTransactionRange': 'Maximum transactions must be greater than minimum transactions',
  'customer.invalidAmountRange': 'Maximum amount must be greater than minimum amount'
};

module.exports = {
  customerValidators,
  errorMessages
};