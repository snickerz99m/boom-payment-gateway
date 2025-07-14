const { logger, logPaymentAttempt, logPaymentSuccess, logPaymentFailure } = require('../utils/logger');
const { validateCardData, detectCardType, getBin } = require('../utils/cardValidator');
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

// Import models
const Customer = require('../models/Customer');
const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction');

// Import payment processors
const StripeService = require('./stripe.service');
const PayPalService = require('./paypal.service');

/**
 * Payment Service
 * Handles payment processing with real payment processors
 */
class PaymentService {
  constructor() {
    this.processingFeePercentage = 0.029; // 2.9%
    this.processingFeeFixed = 30; // $0.30 in cents
    this.maxAmount = 99999999; // $999,999.99 in cents
    this.minAmount = 1; // $0.01 in cents
    this.preferredProcessor = process.env.PREFERRED_PAYMENT_PROCESSOR || 'stripe';
    
    // Initialize payment processors
    this.stripeService = new StripeService();
    this.paypalService = new PayPalService();
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
   * Process payment with gateway (simulated)
   * @param {object} transaction - Transaction object
   * @param {object} paymentMethod - Payment method object
   * @param {object} paymentData - Payment data
   * @param {object} riskAssessment - Risk assessment
   * @returns {object} - Processing result
   */
  /**
   * Process payment with real payment gateway
   * @param {object} transaction - Transaction object
   * @param {object} paymentMethod - Payment method object
   * @param {object} paymentData - Payment data
   * @param {object} riskAssessment - Risk assessment result
   * @returns {object} - Processing result
   */
  async processPaymentWithGateway(transaction, paymentMethod, paymentData, riskAssessment) {
    const startTime = Date.now();
    
    try {
      // Prepare payment data for gateway
      const gatewayPaymentData = {
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        cardData: paymentData.cardData || this.getCardDataFromToken(paymentMethod),
        customerData: {
          email: paymentData.customerInfo?.email || 'guest@example.com',
          firstName: paymentData.customerInfo?.firstName || 'Guest',
          lastName: paymentData.customerInfo?.lastName || 'Customer'
        }
      };

      // Determine CVV result
      let cvvResult = CVV_VALIDATION.NOT_PROVIDED;
      if (gatewayPaymentData.cardData.cvv) {
        cvvResult = CVV_VALIDATION.MATCH; // Will be validated by gateway
      }

      // Choose payment processor based on configuration or card type
      const processor = this.selectPaymentProcessor(paymentData, riskAssessment);
      
      let processingResult;
      
      // Check if we're in test mode and should use simulation
      if (process.env.PAYMENT_MODE === 'test' || process.env.NODE_ENV === 'development') {
        processingResult = await this.simulatePaymentProcessing(gatewayPaymentData, riskAssessment);
      } else {
        // Process with real payment gateway
        switch (processor) {
          case 'stripe':
            processingResult = await this.stripeService.processPayment(gatewayPaymentData);
            break;
          case 'paypal':
            processingResult = await this.paypalService.processPayment(gatewayPaymentData);
            break;
          default:
            throw new Error(`Unsupported payment processor: ${processor}`);
        }
      }

      const processingTime = Date.now() - startTime;

      // Map gateway response to internal format
      const result = {
        success: processingResult.success,
        status: processingResult.status || (processingResult.success ? TRANSACTION_STATUS.COMPLETED : TRANSACTION_STATUS.FAILED),
        responseCode: processingResult.gatewayResponse?.responseCode || (processingResult.success ? RESPONSE_CODES.SUCCESS : RESPONSE_CODES.DECLINED),
        responseMessage: processingResult.gatewayResponse?.responseMessage || (processingResult.success ? 'Payment processed successfully' : 'Payment failed'),
        gatewayTransactionId: processingResult.transactionId,
        processingTime,
        cvvResult,
        paymentMethod: processingResult.paymentMethod || {
          cardType: paymentMethod.cardType,
          cardBrand: paymentMethod.cardBrand,
          cardLast4: paymentMethod.cardLast4,
          expiryDate: `${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}`
        }
      };

      logger.info(`Payment processing completed in ${processingTime}ms with ${processor}`, {
        transactionId: transaction.transactionId,
        success: result.success,
        processor
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Payment processing failed:', error);
      
      return {
        success: false,
        status: TRANSACTION_STATUS.FAILED,
        responseCode: RESPONSE_CODES.PROCESSING_ERROR,
        responseMessage: 'Payment processing failed',
        gatewayTransactionId: null,
        processingTime,
        cvvResult: CVV_VALIDATION.NOT_PROVIDED,
        error: error.message
      };
    }
  }

  /**
   * Select payment processor based on configuration and data
   * @param {object} paymentData - Payment data
   * @param {object} riskAssessment - Risk assessment
   * @returns {string} - Processor name
   */
  selectPaymentProcessor(paymentData, riskAssessment) {
    // Force specific processor if requested
    if (paymentData.preferredProcessor) {
      return paymentData.preferredProcessor;
    }

    // Use configuration default
    return this.preferredProcessor;
  }

  /**
   * Get card data from encrypted token
   * @param {object} paymentMethod - Payment method object
   * @returns {object} - Card data
   */
  getCardDataFromToken(paymentMethod) {
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
   * Simulate payment processing for testing
   * @param {object} gatewayPaymentData - Gateway payment data
   * @param {object} riskAssessment - Risk assessment
   * @returns {object} - Processing result
   */
  async simulatePaymentProcessing(gatewayPaymentData, riskAssessment) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const { cardData } = gatewayPaymentData;
    const cardNumber = cardData.cardNumber;

    // Check if it's a test card
    const isTestCard = Object.values(TEST_CARDS).includes(cardNumber);

    // Simulate various failure scenarios
    if (isTestCard && cardNumber === TEST_CARDS.VISA_DECLINED) {
      return {
        success: false,
        status: TRANSACTION_STATUS.FAILED,
        gatewayResponse: {
          responseCode: RESPONSE_CODES.DECLINED,
          responseMessage: 'Card declined'
        }
      };
    }

    if (riskAssessment.level === 'very_high') {
      if (Math.random() > 0.7) { // 30% success rate for very high risk
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          gatewayResponse: {
            responseCode: RESPONSE_CODES.FRAUD_SUSPECTED,
            responseMessage: 'Transaction flagged for fraud review'
          }
        };
      }
    } else if (riskAssessment.level === 'high') {
      if (Math.random() > 0.85) { // 15% failure rate for high risk
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          gatewayResponse: {
            responseCode: RESPONSE_CODES.DECLINED,
            responseMessage: 'Card declined'
          }
        };
      }
    } else {
      if (Math.random() > 0.95) { // 5% failure rate for low/medium risk
        return {
          success: false,
          status: TRANSACTION_STATUS.FAILED,
          gatewayResponse: {
            responseCode: RESPONSE_CODES.PROCESSING_ERROR,
            responseMessage: 'Processing error occurred'
          }
        };
      }
    }

    // Simulate successful payment
    return {
      success: true,
      status: TRANSACTION_STATUS.COMPLETED,
      transactionId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gatewayResponse: {
        responseCode: RESPONSE_CODES.SUCCESS,
        responseMessage: 'Payment processed successfully',
        gatewayTransactionId: `gw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      paymentMethod: {
        brand: detectCardType(cardNumber),
        last4: cardNumber.slice(-4),
        expMonth: parseInt(cardData.expiryDate.split('/')[0]),
        expYear: parseInt(cardData.expiryDate.split('/')[1])
      }
    };
  }
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