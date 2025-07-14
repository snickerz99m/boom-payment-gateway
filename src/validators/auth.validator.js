const Joi = require('joi');

// Authentication validation schemas
const authValidators = {
  // User registration validation
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    
    // Terms and conditions
    agreeToTerms: Joi.boolean().valid(true).required(),
    agreeToPrivacyPolicy: Joi.boolean().valid(true).required(),
    
    // Marketing preferences
    allowMarketing: Joi.boolean().default(false).optional(),
    
    // Additional data
    referralCode: Joi.string().max(50).optional(),
    source: Joi.string().max(100).optional()
  }).custom((value, helpers) => {
    // Ensure password and confirm password match
    if (value.password !== value.confirmPassword) {
      return helpers.error('auth.passwordMismatch');
    }
    
    // Password strength validation
    if (!isPasswordStrong(value.password)) {
      return helpers.error('auth.passwordTooWeak');
    }
    
    return value;
  }),

  // User login validation
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false).optional(),
    captchaToken: Joi.string().optional() // For bot protection
  }),

  // Password reset request validation
  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
    captchaToken: Joi.string().optional()
  }),

  // Password reset validation
  resetPassword: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().required()
  }).custom((value, helpers) => {
    // Ensure password and confirm password match
    if (value.password !== value.confirmPassword) {
      return helpers.error('auth.passwordMismatch');
    }
    
    // Password strength validation
    if (!isPasswordStrong(value.password)) {
      return helpers.error('auth.passwordTooWeak');
    }
    
    return value;
  }),

  // Change password validation
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().required()
  }).custom((value, helpers) => {
    // Ensure new password and confirm password match
    if (value.newPassword !== value.confirmPassword) {
      return helpers.error('auth.passwordMismatch');
    }
    
    // Ensure new password is different from current password
    if (value.currentPassword === value.newPassword) {
      return helpers.error('auth.passwordSameAsCurrent');
    }
    
    // Password strength validation
    if (!isPasswordStrong(value.newPassword)) {
      return helpers.error('auth.passwordTooWeak');
    }
    
    return value;
  }),

  // Email verification validation
  verifyEmail: Joi.object({
    token: Joi.string().required(),
    email: Joi.string().email().optional()
  }),

  // Resend verification email validation
  resendVerificationEmail: Joi.object({
    email: Joi.string().email().required()
  }),

  // Two-factor authentication setup validation
  setupTwoFactor: Joi.object({
    method: Joi.string().valid('sms', 'app', 'email').required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).when('method', {
      is: 'sms',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }),

  // Two-factor authentication verification validation
  verifyTwoFactor: Joi.object({
    code: Joi.string().pattern(/^[0-9]{6}$/).required(),
    method: Joi.string().valid('sms', 'app', 'email').required()
  }),

  // Update profile validation
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    
    // Preferences
    allowMarketing: Joi.boolean().optional(),
    language: Joi.string().valid('en', 'es', 'fr', 'de', 'it').default('en').optional(),
    timezone: Joi.string().optional(),
    
    // Notification preferences
    emailNotifications: Joi.boolean().default(true).optional(),
    smsNotifications: Joi.boolean().default(false).optional(),
    pushNotifications: Joi.boolean().default(true).optional()
  }),

  // API key generation validation
  generateApiKey: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500).optional(),
    permissions: Joi.array().items(
      Joi.string().valid(
        'read_payments',
        'write_payments',
        'read_customers',
        'write_customers',
        'read_transactions',
        'write_transactions',
        'read_refunds',
        'write_refunds'
      )
    ).min(1).required(),
    expiresAt: Joi.date().iso().greater('now').optional(),
    ipWhitelist: Joi.array().items(
      Joi.string().ip({ version: ['ipv4', 'ipv6'] })
    ).optional()
  }),

  // API key update validation
  updateApiKey: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    description: Joi.string().max(500).optional(),
    permissions: Joi.array().items(
      Joi.string().valid(
        'read_payments',
        'write_payments',
        'read_customers',
        'write_customers',
        'read_transactions',
        'write_transactions',
        'read_refunds',
        'write_refunds'
      )
    ).min(1).optional(),
    expiresAt: Joi.date().iso().greater('now').optional(),
    ipWhitelist: Joi.array().items(
      Joi.string().ip({ version: ['ipv4', 'ipv6'] })
    ).optional(),
    isActive: Joi.boolean().optional()
  }),

  // Session validation
  validateSession: Joi.object({
    token: Joi.string().required(),
    refreshToken: Joi.string().optional()
  }),

  // Logout validation
  logout: Joi.object({
    token: Joi.string().required(),
    logoutAll: Joi.boolean().default(false).optional()
  }),

  // Account deletion validation
  deleteAccount: Joi.object({
    password: Joi.string().required(),
    reason: Joi.string().valid(
      'no_longer_needed',
      'privacy_concerns',
      'security_concerns',
      'switching_service',
      'other'
    ).optional(),
    feedback: Joi.string().max(1000).optional(),
    confirmEmail: Joi.string().email().required()
  }),

  // Security log query validation
  securityLog: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    eventType: Joi.string().valid(
      'login',
      'logout',
      'password_change',
      'email_change',
      'profile_update',
      'api_key_created',
      'api_key_deleted',
      'two_factor_enabled',
      'two_factor_disabled',
      'failed_login',
      'account_locked'
    ).optional(),
    page: Joi.number().integer().min(1).default(1).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional()
  }).custom((value, helpers) => {
    // Ensure end date is after start date
    if (value.startDate && value.endDate && value.endDate <= value.startDate) {
      return helpers.error('auth.invalidDateRange');
    }
    
    // Default to last 30 days if no date range provided
    if (!value.startDate && !value.endDate) {
      const now = new Date();
      value.endDate = now;
      value.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return value;
  }),

  // Merchant registration validation
  registerMerchant: Joi.object({
    // Business information
    businessName: Joi.string().min(2).max(200).required(),
    businessType: Joi.string().valid(
      'sole_proprietorship',
      'partnership',
      'corporation',
      'llc',
      'non_profit',
      'other'
    ).required(),
    businessDescription: Joi.string().max(1000).optional(),
    website: Joi.string().uri().optional(),
    
    // Contact information
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    
    // Business address
    address: Joi.string().max(200).required(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).required(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
    country: Joi.string().length(2).default('US').required(),
    
    // Tax information
    taxId: Joi.string().max(50).optional(),
    
    // Representative information
    representative: Joi.object({
      firstName: Joi.string().min(2).max(50).required(),
      lastName: Joi.string().min(2).max(50).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
      title: Joi.string().max(100).required(),
      dateOfBirth: Joi.date().iso().max('now').required(),
      ssn: Joi.string().pattern(/^\d{3}-\d{2}-\d{4}$/).required()
    }).required(),
    
    // Account setup
    password: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().required(),
    
    // Agreements
    agreeToTerms: Joi.boolean().valid(true).required(),
    agreeToPrivacyPolicy: Joi.boolean().valid(true).required(),
    agreeToPciCompliance: Joi.boolean().valid(true).required()
  }).custom((value, helpers) => {
    // Ensure password and confirm password match
    if (value.password !== value.confirmPassword) {
      return helpers.error('auth.passwordMismatch');
    }
    
    // Password strength validation
    if (!isPasswordStrong(value.password)) {
      return helpers.error('auth.passwordTooWeak');
    }
    
    return value;
  })
};

// Password strength validation function
function isPasswordStrong(password) {
  // At least 8 characters
  if (password.length < 8) return false;
  
  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) return false;
  
  // At least one lowercase letter
  if (!/[a-z]/.test(password)) return false;
  
  // At least one number
  if (!/[0-9]/.test(password)) return false;
  
  // At least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  
  return true;
}

// Custom error messages
const errorMessages = {
  'auth.passwordMismatch': 'Password and confirm password must match',
  'auth.passwordTooWeak': 'Password must contain at least 8 characters with uppercase, lowercase, number, and special character',
  'auth.passwordSameAsCurrent': 'New password must be different from current password',
  'auth.invalidDateRange': 'End date must be after start date'
};

module.exports = {
  authValidators,
  errorMessages,
  isPasswordStrong
};