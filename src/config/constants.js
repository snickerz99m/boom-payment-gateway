// Application constants
module.exports = {
  // Card types
  CARD_TYPES: {
    VISA: 'visa',
    MASTERCARD: 'mastercard',
    AMEX: 'amex',
    DISCOVER: 'discover',
    UNKNOWN: 'unknown'
  },

  // Transaction statuses
  TRANSACTION_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
    CANCELLED: 'cancelled'
  },

  // Payment methods
  PAYMENT_METHODS: {
    CREDIT_CARD: 'credit_card',
    DEBIT_CARD: 'debit_card',
    PREPAID_CARD: 'prepaid_card'
  },

  // Risk levels
  RISK_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    VERY_HIGH: 'very_high'
  },

  // CVV validation results
  CVV_VALIDATION: {
    MATCH: 'match',
    NO_MATCH: 'no_match',
    NOT_PROCESSED: 'not_processed',
    NOT_PROVIDED: 'not_provided',
    SHOULD_HAVE_BEEN_PRESENT: 'should_have_been_present'
  },

  // Supported currencies
  CURRENCIES: {
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    CAD: 'CAD'
  },

  // Currency symbols
  CURRENCY_SYMBOLS: {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$'
  },

  // Response codes
  RESPONSE_CODES: {
    SUCCESS: '00',
    INSUFFICIENT_FUNDS: '51',
    EXPIRED_CARD: '54',
    INVALID_CARD: '14',
    DECLINED: '05',
    PROCESSING_ERROR: '96',
    INVALID_CVV: '82',
    FRAUD_SUSPECTED: '59'
  },

  // Minimum and maximum amounts (in cents)
  AMOUNT_LIMITS: {
    MIN: 1, // $0.01
    MAX: 99999999 // $999,999.99
  },

  // Card number patterns
  CARD_PATTERNS: {
    VISA: /^4[0-9]{12}(?:[0-9]{3})?$/,
    MASTERCARD: /^5[1-5][0-9]{14}$/,
    AMEX: /^3[47][0-9]{13}$/,
    DISCOVER: /^6(?:011|5[0-9]{2})[0-9]{12}$/
  },

  // CVV length by card type
  CVV_LENGTHS: {
    VISA: 3,
    MASTERCARD: 3,
    AMEX: 4,
    DISCOVER: 3
  },

  // API error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    PAYMENT_ERROR: 'PAYMENT_ERROR',
    CARD_ERROR: 'CARD_ERROR',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    DUPLICATE_ERROR: 'DUPLICATE_ERROR'
  },

  // Webhook event types
  WEBHOOK_EVENTS: {
    PAYMENT_COMPLETED: 'payment.completed',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUNDED: 'payment.refunded',
    CUSTOMER_CREATED: 'customer.created',
    TRANSACTION_UPDATED: 'transaction.updated'
  },

  // Default pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // Token expiration times
  TOKEN_EXPIRATION: {
    ACCESS_TOKEN: '1h',
    REFRESH_TOKEN: '7d',
    PAYMENT_TOKEN: '15m'
  },

  // Encryption settings
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16
  },

  // Regular expressions
  REGEX: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^\+?[1-9]\d{1,14}$/,
    ZIP_CODE: /^\d{5}(-\d{4})?$/,
    CARD_NUMBER: /^[0-9]{13,19}$/,
    CVV: /^[0-9]{3,4}$/
  },

  // Test card numbers for development
  TEST_CARDS: {
    VISA_SUCCESS: '4111111111111111',
    VISA_DECLINED: '4000000000000002',
    MASTERCARD_SUCCESS: '5555555555554444',
    MASTERCARD_DECLINED: '5105105105105100',
    AMEX_SUCCESS: '378282246310005',
    DISCOVER_SUCCESS: '6011111111111117'
  },

  // Database table names
  TABLES: {
    CUSTOMERS: 'customers',
    PAYMENT_METHODS: 'payment_methods',
    TRANSACTIONS: 'transactions',
    REFUNDS: 'refunds',
    WEBHOOKS: 'webhooks',
    API_KEYS: 'api_keys'
  }
};