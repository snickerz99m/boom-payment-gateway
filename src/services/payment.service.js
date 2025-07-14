const { logger, logPaymentAttempt, logPaymentSuccess, logPaymentFailure } = require('../utils/logger');
const { validateCardData, detectCardType, getBin } = require('../utils/cardValidator');
const { generateCardToken, decryptCardToken } = require('../utils/encryption');
const { 
  generateTransactionId, 
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

// Import models
const Customer = require('../models/Customer');
const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction');

/**
 * Payment Service
 * Handles payment processing with CVV and non-CVV support
 */
class PaymentService {
  constructor() {
    this.processingFeePercentage = 0.029; // 2.9%
    this.processingFeeFixed = 30; // $0.30 in cents
    this.maxAmount = 99999999; // $999,999.99 in cents
    this.minAmount = 1; // $0.01 in cents
  }

  /**
   * Process a payment transaction
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
        processingStartedAt: new Date()
      });

      // Log payment attempt
      logPaymentAttempt({
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        currency: transaction.currency,
        cardType: paymentMethod.cardType,
        cardLast4: paymentMethod.cardLast4,
        cvvProvided: paymentData.cvv ? true : false,
        riskLevel: riskAssessment.level,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });

      // Process the payment
      const processingResult = await this.processPaymentWithGateway(
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
        gatewayTransactionId: processingResult.gatewayTransactionId,
        cvvResult: processingResult.cvvResult,
        processingCompletedAt: new Date(),
        processingTimeMs: Date.now() - startTime
      });

      // Log success or failure
      if (processingResult.status === TRANSACTION_STATUS.COMPLETED) {
        logPaymentSuccess({
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          currency: transaction.currency,
          cardType: paymentMethod.cardType,
          cardLast4: paymentMethod.cardLast4,
          processingTime: Date.now() - startTime
        });
      } else {
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
          transactionId: processingResult.gatewayTransactionId
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
   * Process payment with gateway (simulated)
   * @param {object} transaction - Transaction object
   * @param {object} paymentMethod - Payment method object
   * @param {object} paymentData - Payment data
   * @param {object} riskAssessment - Risk assessment
   * @returns {object} - Processing result
   */
  async processPaymentWithGateway(transaction, paymentMethod, paymentData, riskAssessment) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Get card data for processing
    let cardNumber;
    let cvv;

    if (paymentData.cardData) {
      cardNumber = paymentData.cardData.cardNumber;
      cvv = paymentData.cardData.cvv;
    } else {
      // Decrypt card data from token
      const decryptedData = decryptCardToken(paymentMethod.encryptedCardData);
      cardNumber = decryptedData.cardNumber;
      cvv = paymentData.cvv; // CVV is not stored, must be provided fresh
    }

    // Determine CVV result
    let cvvResult = CVV_VALIDATION.NOT_PROVIDED;
    if (cvv) {
      // Simulate CVV validation
      if (Math.random() > 0.05) { // 95% success rate
        cvvResult = CVV_VALIDATION.MATCH;
      } else {
        cvvResult = CVV_VALIDATION.NO_MATCH;
      }
    }

    // Check if it's a test card
    const isTestCard = Object.values(TEST_CARDS).includes(cardNumber);

    // Simulate payment processing logic
    let status = TRANSACTION_STATUS.COMPLETED;
    let responseCode = RESPONSE_CODES.SUCCESS;
    let responseMessage = 'Payment processed successfully';

    // Simulate various failure scenarios
    if (isTestCard && cardNumber === TEST_CARDS.VISA_DECLINED) {
      status = TRANSACTION_STATUS.FAILED;
      responseCode = RESPONSE_CODES.DECLINED;
      responseMessage = 'Card declined';
    } else if (cvvResult === CVV_VALIDATION.NO_MATCH) {
      status = TRANSACTION_STATUS.FAILED;
      responseCode = RESPONSE_CODES.INVALID_CVV;
      responseMessage = 'Invalid CVV';
    } else if (riskAssessment.level === 'very_high') {
      // High risk transactions have higher failure rate
      if (Math.random() > 0.7) { // 30% success rate for very high risk
        status = TRANSACTION_STATUS.FAILED;
        responseCode = RESPONSE_CODES.FRAUD_SUSPECTED;
        responseMessage = 'Transaction flagged for fraud review';
      }
    } else if (riskAssessment.level === 'high') {
      // High risk transactions have moderate failure rate
      if (Math.random() > 0.85) { // 15% failure rate for high risk
        status = TRANSACTION_STATUS.FAILED;
        responseCode = RESPONSE_CODES.DECLINED;
        responseMessage = 'Card declined';
      }
    } else {
      // Low/medium risk transactions have low failure rate
      if (Math.random() > 0.95) { // 5% failure rate for low/medium risk
        status = TRANSACTION_STATUS.FAILED;
        responseCode = RESPONSE_CODES.PROCESSING_ERROR;
        responseMessage = 'Processing error occurred';
      }
    }

    // Generate gateway transaction ID
    const gatewayTransactionId = `gw_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    return {
      status,
      responseCode,
      responseMessage,
      gatewayTransactionId,
      cvvResult,
      processingTime: Date.now()
    };
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

module.exports = new PaymentService();