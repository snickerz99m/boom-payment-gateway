const { logger, logPaymentAttempt, logPaymentSuccess, logPaymentFailure } = require('../utils/logger');
const { validateCardData, detectCardType, getBin, validateCvv, validateExpiryDate } = require('../utils/cardValidator');
const { generateCardToken, decryptCardToken } = require('../utils/encryption');
const { 
  generateTransactionId, 
  generateCustomerId,
  toCents, 
  fromCents, 
  validateAmount, 
  validateCurrency,
  calculateRiskScore
} = require('../utils/helpers');
const { 
  TRANSACTION_STATUS, 
  CVV_VALIDATION, 
  RESPONSE_CODES,
  TEST_CARDS 
} = require('../config/constants');
const notificationService = require('./notification.service');

// Import models
const Customer = require('../models/Customer');
const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');

/**
 * Standalone Payment Service
 * Handles payment processing without third-party processors
 */
class StandalonePaymentService {
  constructor() {
    this.processingFeePercentage = 0.029; // 2.9%
    this.processingFeeFixed = 30; // $0.30 in cents
    this.maxAmount = 99999999; // $999,999.99 in cents
    this.minAmount = 1; // $0.01 in cents
    
    // Card network configurations
    this.cardNetworks = {
      visa: {
        minLength: 13,
        maxLength: 19,
        cvvLength: 3,
        luhnCheck: true
      },
      mastercard: {
        minLength: 16,
        maxLength: 16,
        cvvLength: 3,
        luhnCheck: true
      },
      amex: {
        minLength: 15,
        maxLength: 15,
        cvvLength: 4,
        luhnCheck: true
      },
      discover: {
        minLength: 16,
        maxLength: 16,
        cvvLength: 3,
        luhnCheck: true
      }
    };
    
    // Initialize business hours (can be configured)
    this.businessHours = {
      enabled: false,
      timezone: 'UTC',
      start: '09:00',
      end: '17:00',
      weekends: false
    };
  }

  /**
   * Process a payment transaction independently
   * @param {object} paymentData - Payment data
   * @param {object} options - Processing options
   * @returns {object} - Transaction result
   */
  async processPayment(paymentData, options = {}) {
    const startTime = Date.now();
    let transaction = null;

    try {
      // Validate payment data
      const validationResult = await this.validatePaymentData(paymentData);
      if (!validationResult.isValid) {
        throw new Error(`Payment validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Get or create customer
      const customer = await this.getOrCreateCustomer(paymentData);

      // Get or create payment method
      const paymentMethod = await this.getOrCreatePaymentMethod(paymentData, customer);

      // Create transaction record
      transaction = await this.createTransaction(paymentData, customer, paymentMethod);

      // Calculate risk score
      const riskAssessment = this.calculateTransactionRisk(paymentData, customer, paymentMethod);
      
      // Update transaction with risk assessment
      await transaction.update({
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
        riskFactors: riskAssessment.factors,
        processingStartedAt: new Date(),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        deviceFingerprint: options.deviceFingerprint
      });

      // Log payment attempt
      logPaymentAttempt({
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        cardType: paymentMethod.cardType,
        cardLast4: paymentMethod.cardLast4,
        cvvProvided: paymentData.cardData?.cvv ? true : false,
        riskLevel: riskAssessment.level,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });

      // Process the payment with standalone logic
      const processingResult = await this.processPaymentStandalone(
        transaction,
        paymentMethod,
        paymentData,
        riskAssessment
      );

      // Update transaction with result
      await transaction.update({
        status: processingResult.status,
        gatewayResponseCode: processingResult.responseCode,
        gatewayResponseMessage: processingResult.responseMessage,
        gatewayTransactionId: processingResult.transactionId,
        cvvResult: processingResult.cvvResult,
        processingCompletedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        refundableAmount: processingResult.status === TRANSACTION_STATUS.COMPLETED ? transaction.amount : 0
      });

      // Log success or failure
      if (processingResult.status === TRANSACTION_STATUS.COMPLETED) {
        // Update customer and payment method success counts
        await this.updateSuccessMetrics(customer, paymentMethod);
        
        logPaymentSuccess({
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          currency: transaction.currency,
          cardType: paymentMethod.cardType,
          cardLast4: paymentMethod.cardLast4,
          processingTime: Date.now() - startTime
        });

        // Send payment confirmation
        await this.sendPaymentConfirmation(transaction, customer, paymentMethod);
      } else {
        // Update failure metrics
        await this.updateFailureMetrics(customer, paymentMethod);
        
        logPaymentFailure({
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          currency: transaction.currency,
          cardType: paymentMethod.cardType,
          cardLast4: paymentMethod.cardLast4,
          errorCode: processingResult.responseCode,
          errorMessage: processingResult.responseMessage
        });
      }

      // Return transaction result
      return {
        success: processingResult.status === TRANSACTION_STATUS.COMPLETED,
        transaction: {
          id: transaction.transactionId,
          status: transaction.status,
          amount: fromCents(transaction.amount),
          currency: transaction.currency,
          description: transaction.description,
          riskLevel: transaction.riskLevel,
          riskScore: transaction.riskScore,
          cvvProvided: transaction.cvvProvided,
          cvvResult: transaction.cvvResult,
          processingTime: transaction.processingTimeMs,
          createdAt: transaction.createdAt
        },
        paymentMethod: {
          cardType: paymentMethod.cardType,
          cardBrand: paymentMethod.cardBrand,
          cardLast4: paymentMethod.cardLast4,
          expiryDate: paymentMethod.getExpiryDate()
        },
        customer: {
          id: customer.customerId,
          email: customer.email,
          name: customer.getFullName()
        },
        gateway: {
          responseCode: processingResult.responseCode,
          responseMessage: processingResult.responseMessage,
          transactionId: processingResult.transactionId,
          processor: 'boom-standalone'
        }
      };

    } catch (error) {
      logger.error('Payment processing failed:', error);

      // Update transaction if it exists
      if (transaction) {
        await transaction.update({
          status: TRANSACTION_STATUS.FAILED,
          gatewayResponseMessage: error.message,
          processingCompletedAt: new Date(),
          processingTimeMs: Date.now() - startTime
        });
      }

      throw error;
    }
  }

  /**
   * Standalone payment processing logic
   * @param {object} transaction - Transaction object
   * @param {object} paymentMethod - Payment method object
   * @param {object} paymentData - Payment data
   * @param {object} riskAssessment - Risk assessment
   * @returns {object} - Processing result
   */
  async processPaymentStandalone(transaction, paymentMethod, paymentData, riskAssessment) {
    const startTime = Date.now();
    
    try {
      // Get card data
      const cardData = paymentData.cardData || await this.getCardDataFromToken(paymentMethod);
      
      // Validate card data thoroughly
      const cardValidation = await this.validateCardForProcessing(cardData, paymentMethod);
      if (!cardValidation.isValid) {
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          responseCode: RESPONSE_CODES.INVALID_CARD,
          responseMessage: cardValidation.errors.join(', '),
          cvvResult: CVV_VALIDATION.INVALID,
          transactionId: null,
          processingTime: Date.now() - startTime
        };
      }

      // Check if transaction should be declined based on risk
      const riskDecision = this.evaluateRiskDecision(riskAssessment, transaction);
      if (riskDecision.decline) {
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          responseCode: RESPONSE_CODES.FRAUD_SUSPECTED,
          responseMessage: riskDecision.reason,
          cvvResult: cardValidation.cvvResult,
          transactionId: null,
          processingTime: Date.now() - startTime
        };
      }

      // Check business hours if enabled
      if (this.businessHours.enabled && !this.isWithinBusinessHours()) {
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          responseCode: RESPONSE_CODES.DECLINED,
          responseMessage: 'Transaction declined - outside business hours',
          cvvResult: cardValidation.cvvResult,
          transactionId: null,
          processingTime: Date.now() - startTime
        };
      }

      // Simulate card authorization process
      const authResult = await this.simulateCardAuthorization(cardData, transaction, riskAssessment);
      
      if (!authResult.approved) {
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          responseCode: authResult.responseCode,
          responseMessage: authResult.responseMessage,
          cvvResult: cardValidation.cvvResult,
          transactionId: null,
          processingTime: Date.now() - startTime
        };
      }

      // Generate transaction ID
      const transactionId = `boom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Successful processing
      return {
        success: true,
        status: TRANSACTION_STATUS.COMPLETED,
        responseCode: RESPONSE_CODES.SUCCESS,
        responseMessage: 'Payment processed successfully',
        transactionId: transactionId,
        cvvResult: cardValidation.cvvResult,
        processingTime: Date.now() - startTime,
        authCode: authResult.authCode,
        paymentMethod: {
          cardType: paymentMethod.cardType,
          cardBrand: paymentMethod.cardBrand,
          cardLast4: paymentMethod.cardLast4,
          expiryDate: paymentMethod.getExpiryDate()
        }
      };

    } catch (error) {
      logger.error('Standalone payment processing failed:', error);
      
      return {
        success: false,
        status: TRANSACTION_STATUS.FAILED,
        responseCode: RESPONSE_CODES.PROCESSING_ERROR,
        responseMessage: 'Payment processing failed',
        transactionId: null,
        cvvResult: CVV_VALIDATION.NOT_PROVIDED,
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Validate card data for processing
   * @param {object} cardData - Card data
   * @param {object} paymentMethod - Payment method
   * @returns {object} - Validation result
   */
  async validateCardForProcessing(cardData, paymentMethod) {
    const errors = [];
    let cvvResult = CVV_VALIDATION.NOT_PROVIDED;

    // Validate card number
    const cardValidation = validateCardData(cardData);
    if (!cardValidation.isValid) {
      errors.push(...cardValidation.errors);
    }

    // Validate expiry date
    const expiryValidation = validateExpiryDate(cardData.expiryDate);
    if (!expiryValidation) {
      errors.push('Card expired or invalid expiry date');
    }

    // Validate CVV if provided
    if (cardData.cvv) {
      const cardType = detectCardType(cardData.cardNumber);
      const cvvValidation = validateCvv(cardData.cvv, cardType);
      if (cvvValidation) {
        cvvResult = CVV_VALIDATION.MATCH;
      } else {
        cvvResult = CVV_VALIDATION.INVALID;
        errors.push('Invalid CVV');
      }
    }

    // Check for test cards that should be declined
    if (cardData.cardNumber === TEST_CARDS.VISA_DECLINED) {
      errors.push('Test card declined');
    }

    return {
      isValid: errors.length === 0,
      errors,
      cvvResult
    };
  }

  /**
   * Evaluate risk decision
   * @param {object} riskAssessment - Risk assessment
   * @param {object} transaction - Transaction
   * @returns {object} - Risk decision
   */
  evaluateRiskDecision(riskAssessment, transaction) {
    // Very high risk - decline
    if (riskAssessment.level === 'very_high') {
      return {
        decline: true,
        reason: 'Transaction declined due to high risk score'
      };
    }

    // High risk - random decline
    if (riskAssessment.level === 'high' && Math.random() > 0.85) {
      return {
        decline: true,
        reason: 'Transaction declined for security reasons'
      };
    }

    // Check for velocity limits (amount-based)
    if (transaction.amount > 100000) { // $1000+ transactions
      return {
        decline: true,
        reason: 'Transaction amount exceeds limits'
      };
    }

    return {
      decline: false,
      reason: null
    };
  }

  /**
   * Simulate card authorization
   * @param {object} cardData - Card data
   * @param {object} transaction - Transaction
   * @param {object} riskAssessment - Risk assessment
   * @returns {object} - Authorization result
   */
  async simulateCardAuthorization(cardData, transaction, riskAssessment) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

    const cardNumber = cardData.cardNumber;

    // Check for specific test cards
    if (cardNumber === TEST_CARDS.VISA_DECLINED) {
      return {
        approved: false,
        responseCode: RESPONSE_CODES.DECLINED,
        responseMessage: 'Card declined by issuer'
      };
    }

    // Simulate various decline scenarios based on risk
    const declineChance = this.getDeclineChance(riskAssessment.level);
    
    if (Math.random() < declineChance) {
      const declineReasons = [
        { code: RESPONSE_CODES.DECLINED, message: 'Card declined' },
        { code: RESPONSE_CODES.INSUFFICIENT_FUNDS, message: 'Insufficient funds' },
        { code: RESPONSE_CODES.EXPIRED_CARD, message: 'Card expired' },
        { code: RESPONSE_CODES.INVALID_CARD, message: 'Invalid card number' }
      ];
      
      const reason = declineReasons[Math.floor(Math.random() * declineReasons.length)];
      return {
        approved: false,
        responseCode: reason.code,
        responseMessage: reason.message
      };
    }

    // Successful authorization
    return {
      approved: true,
      responseCode: RESPONSE_CODES.SUCCESS,
      responseMessage: 'Approved',
      authCode: this.generateAuthCode()
    };
  }

  /**
   * Get decline chance based on risk level
   * @param {string} riskLevel - Risk level
   * @returns {number} - Decline chance (0-1)
   */
  getDeclineChance(riskLevel) {
    switch (riskLevel) {
      case 'very_high': return 0.7;
      case 'high': return 0.15;
      case 'medium': return 0.08;
      case 'low': return 0.05;
      default: return 0.05;
    }
  }

  /**
   * Generate authorization code
   * @returns {string} - Authorization code
   */
  generateAuthCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  /**
   * Check if current time is within business hours
   * @returns {boolean} - Whether within business hours
   */
  isWithinBusinessHours() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check weekend restrictions
    if (!this.businessHours.weekends && (day === 0 || day === 6)) {
      return false;
    }
    
    // Check time range
    const currentTime = now.toTimeString().substr(0, 5);
    return currentTime >= this.businessHours.start && currentTime <= this.businessHours.end;
  }

  /**
   * Update success metrics
   * @param {object} customer - Customer object
   * @param {object} paymentMethod - Payment method object
   */
  async updateSuccessMetrics(customer, paymentMethod) {
    // Update customer metrics
    await customer.update({
      totalTransactions: customer.totalTransactions + 1,
      successfulTransactions: customer.successfulTransactions + 1,
      lastTransactionDate: new Date()
    });

    // Update payment method metrics
    await paymentMethod.update({
      totalTransactions: paymentMethod.totalTransactions + 1,
      successfulTransactions: paymentMethod.successfulTransactions + 1,
      lastUsedDate: new Date()
    });
  }

  /**
   * Update failure metrics
   * @param {object} customer - Customer object
   * @param {object} paymentMethod - Payment method object
   */
  async updateFailureMetrics(customer, paymentMethod) {
    // Update customer metrics
    await customer.update({
      totalTransactions: customer.totalTransactions + 1,
      failedTransactions: customer.failedTransactions + 1,
      lastTransactionDate: new Date()
    });

    // Update payment method metrics
    await paymentMethod.update({
      totalTransactions: paymentMethod.totalTransactions + 1,
      failedTransactions: paymentMethod.failedTransactions + 1,
      lastUsedDate: new Date()
    });
  }

  /**
   * Send payment confirmation
   * @param {object} transaction - Transaction object
   * @param {object} customer - Customer object
   * @param {object} paymentMethod - Payment method object
   */
  async sendPaymentConfirmation(transaction, customer, paymentMethod) {
    try {
      // Send email confirmation
      await notificationService.sendPaymentConfirmation({
        customerEmail: customer.email,
        customerName: customer.getFullName(),
        transactionId: transaction.transactionId,
        amount: fromCents(transaction.amount),
        currency: transaction.currency,
        description: transaction.description,
        cardLast4: paymentMethod.cardLast4,
        cardType: paymentMethod.cardType,
        date: transaction.createdAt
      });

      // Mark email as sent
      await transaction.update({
        emailSent: true,
        emailSentAt: new Date()
      });

      logger.info('Payment confirmation sent', {
        transactionId: transaction.transactionId,
        customerEmail: customer.email
      });

    } catch (error) {
      logger.error('Failed to send payment confirmation:', error);
    }
  }

  /**
   * Validate payment data
   * @param {object} paymentData - Payment data to validate
   * @returns {object} - Validation result
   */
  async validatePaymentData(paymentData) {
    const errors = [];

    // Validate amount
    const amountInCents = toCents(paymentData.amount);
    const amountValidation = validateAmount(amountInCents);
    if (!amountValidation.isValid) {
      errors.push(...amountValidation.errors);
    }

    // Validate currency
    if (!validateCurrency(paymentData.currency)) {
      errors.push('Invalid currency');
    }

    // Validate card data if provided
    if (paymentData.cardData) {
      const cardValidation = validateCardData(paymentData.cardData);
      if (!cardValidation.isValid) {
        errors.push(...cardValidation.errors);
      }
    }

    // Ensure payment method is provided
    if (!paymentData.customerId && !paymentData.paymentMethodId && !paymentData.cardToken && !paymentData.cardData) {
      errors.push('Payment method is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get or create customer
   * @param {object} paymentData - Payment data
   * @returns {object} - Customer object
   */
  async getOrCreateCustomer(paymentData) {
    if (paymentData.customerId) {
      const customer = await Customer.findByCustomerId(paymentData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }
      return customer;
    }

    if (paymentData.customerInfo) {
      // Try to find existing customer by email
      let customer = await Customer.findByEmail(paymentData.customerInfo.email);
      
      if (!customer) {
        // Create new customer
        customer = await Customer.create({
          customerId: generateCustomerId(),
          email: paymentData.customerInfo.email,
          firstName: paymentData.customerInfo.firstName || 'Guest',
          lastName: paymentData.customerInfo.lastName || 'Customer',
          phone: paymentData.customerInfo.phone
        });
      }
      
      return customer;
    }

    // Create guest customer
    const guestCustomer = await Customer.create({
      customerId: generateCustomerId(),
      email: `guest_${Date.now()}@example.com`,
      firstName: 'Guest',
      lastName: 'Customer',
      status: 'active'
    });

    return guestCustomer;
  }

  /**
   * Get or create payment method
   * @param {object} paymentData - Payment data
   * @param {object} customer - Customer object
   * @returns {object} - Payment method object
   */
  async getOrCreatePaymentMethod(paymentData, customer) {
    // If payment method ID is provided, use existing method
    if (paymentData.paymentMethodId) {
      const paymentMethod = await PaymentMethod.findByPk(paymentData.paymentMethodId);
      if (!paymentMethod || paymentMethod.customerId !== customer.id) {
        throw new Error('Payment method not found or not owned by customer');
      }
      return paymentMethod;
    }

    // If card token is provided, find the payment method
    if (paymentData.cardToken) {
      const paymentMethod = await PaymentMethod.findByToken(paymentData.cardToken);
      if (!paymentMethod) {
        throw new Error('Invalid card token');
      }
      return paymentMethod;
    }

    // If card data is provided, create or find payment method
    if (paymentData.cardData) {
      const cardData = paymentData.cardData;
      
      // Validate card data
      const cardValidation = validateCardData(cardData);
      if (!cardValidation.isValid) {
        throw new Error(`Invalid card data: ${cardValidation.errors.join(', ')}`);
      }

      // Check if payment method already exists for this customer
      const existingMethods = await PaymentMethod.findByCustomer(customer.id);
      const existingMethod = existingMethods.find(method => 
        method.cardLast4 === cardData.cardNumber.slice(-4) &&
        method.cardBin === cardData.cardNumber.substring(0, 6)
      );

      if (existingMethod) {
        return existingMethod;
      }

      // Create new payment method
      const { token, encryptedData } = generateCardToken(
        cardData.cardNumber,
        cardData.expiryDate
      );

      const cardType = detectCardType(cardData.cardNumber);
      const [month, year] = cardData.expiryDate.split('/');

      const paymentMethod = await PaymentMethod.create({
        customerId: customer.id,
        cardToken: token,
        encryptedCardData: encryptedData,
        cardType: cardType,
        cardBrand: cardValidation.cardBrand,
        cardLast4: cardData.cardNumber.slice(-4),
        cardBin: getBin(cardData.cardNumber),
        expiryMonth: parseInt(month),
        expiryYear: parseInt(year.length === 2 ? `20${year}` : year),
        cardholderName: cardData.cardholderName,
        billingAddress: paymentData.billingAddress?.address,
        billingCity: paymentData.billingAddress?.city,
        billingState: paymentData.billingAddress?.state,
        billingZipCode: paymentData.billingAddress?.zipCode,
        billingCountry: paymentData.billingAddress?.country || 'US',
        cvvSupported: cardData.cvv ? true : false
      });

      return paymentMethod;
    }

    throw new Error('No payment method provided');
  }

  /**
   * Create transaction record
   * @param {object} paymentData - Payment data
   * @param {object} customer - Customer object
   * @param {object} paymentMethod - Payment method object
   * @returns {object} - Transaction object
   */
  async createTransaction(paymentData, customer, paymentMethod) {
    const amountInCents = toCents(paymentData.amount);
    const processingFee = this.calculateProcessingFee(amountInCents);

    const transaction = await Transaction.create({
      transactionId: generateTransactionId(),
      customerId: customer.id,
      paymentMethodId: paymentMethod.id,
      amount: amountInCents,
      currency: paymentData.currency || 'USD',
      description: paymentData.description || 'Payment',
      status: TRANSACTION_STATUS.PENDING,
      cvvProvided: paymentData.cardData?.cvv ? true : false,
      cvvResult: CVV_VALIDATION.NOT_PROVIDED,
      processingFee: processingFee,
      netAmount: amountInCents - processingFee,
      merchantId: paymentData.merchantId,
      merchantName: paymentData.merchantName,
      orderId: paymentData.orderId,
      orderDetails: paymentData.orderDetails || {},
      customerInfo: {
        email: customer.email,
        name: customer.getFullName(),
        phone: customer.phone
      },
      billingAddress: paymentData.billingAddress || {},
      shippingAddress: paymentData.shippingAddress || {},
      metadata: paymentData.metadata || {}
    });

    return transaction;
  }

  /**
   * Calculate processing fee
   * @param {number} amountInCents - Amount in cents
   * @returns {number} - Processing fee in cents
   */
  calculateProcessingFee(amountInCents) {
    return Math.round(amountInCents * this.processingFeePercentage) + this.processingFeeFixed;
  }

  /**
   * Calculate transaction risk
   * @param {object} paymentData - Payment data
   * @param {object} customer - Customer object
   * @param {object} paymentMethod - Payment method object
   * @returns {object} - Risk assessment
   */
  calculateTransactionRisk(paymentData, customer, paymentMethod) {
    return calculateRiskScore({
      amount: toCents(paymentData.amount),
      cvvProvided: paymentData.cardData?.cvv ? true : false,
      cardType: paymentMethod.cardType,
      customerHistory: {
        totalTransactions: customer.totalTransactions,
        successfulTransactions: customer.successfulTransactions,
        failedTransactions: customer.failedTransactions,
        riskLevel: customer.riskLevel
      },
      paymentMethodHistory: {
        totalTransactions: paymentMethod.totalTransactions,
        successfulTransactions: paymentMethod.successfulTransactions,
        failedTransactions: paymentMethod.failedTransactions,
        riskLevel: paymentMethod.riskLevel
      }
    });
  }

  /**
   * Get card data from encrypted token
   * @param {object} paymentMethod - Payment method object
   * @returns {object} - Card data
   */
  async getCardDataFromToken(paymentMethod) {
    try {
      const decryptedData = decryptCardToken(paymentMethod.encryptedCardData);
      return {
        cardNumber: decryptedData.cardNumber,
        expiryDate: decryptedData.expiryDate,
        cardholderName: paymentMethod.cardholderName,
        cvv: null // CVV is never stored, must be provided fresh
      };
    } catch (error) {
      throw new Error('Failed to decrypt card data');
    }
  }

  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {object} - Transaction object
   */
  async getTransaction(transactionId) {
    const transaction = await Transaction.findByTransactionId(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  /**
   * Get transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {object} - Transaction status
   */
  async getTransactionStatus(transactionId) {
    const transaction = await this.getTransaction(transactionId);
    
    return {
      id: transaction.transactionId,
      status: transaction.status,
      amount: fromCents(transaction.amount),
      currency: transaction.currency,
      createdAt: transaction.createdAt,
      completedAt: transaction.processingCompletedAt,
      processingTime: transaction.processingTimeMs
    };
  }

  /**
   * Verify transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} amount - Expected amount
   * @returns {boolean} - Verification result
   */
  async verifyTransaction(transactionId, amount) {
    try {
      const transaction = await this.getTransaction(transactionId);
      const expectedAmountInCents = toCents(parseFloat(amount));
      
      return transaction.amount === expectedAmountInCents &&
             transaction.status === TRANSACTION_STATUS.COMPLETED;
    } catch (error) {
      logger.error('Transaction verification failed:', error);
      return false;
    }
  }
}

module.exports = new StandalonePaymentService();