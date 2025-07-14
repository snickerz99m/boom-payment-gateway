const { logger } = require('../utils/logger');
const { generateCardToken } = require('../utils/encryption');
const { validateCardData, detectCardType, getBin } = require('../utils/cardValidator');
const { CARD_TYPES } = require('../config/constants');

// Import models
const Customer = require('../models/Customer');
const PaymentMethod = require('../models/PaymentMethod');

/**
 * Tokenization Service
 * Handles secure card tokenization and payment method management
 */
class TokenizationService {
  constructor() {
    this.tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Tokenize card data
   * @param {object} cardData - Card data to tokenize
   * @param {string} customerId - Customer ID (optional)
   * @returns {object} - Tokenization result
   */
  async tokenizeCard(cardData, customerId = null) {
    try {
      // Validate card data
      const cardValidation = validateCardData(cardData);
      if (!cardValidation.isValid) {
        throw new Error(`Card validation failed: ${cardValidation.errors.join(', ')}`);
      }

      // Generate secure token
      const { token, encryptedData } = generateCardToken(
        cardData.cardNumber,
        cardData.expiryDate
      );

      // Detect card type and get metadata
      const cardType = detectCardType(cardData.cardNumber);
      const cardBin = getBin(cardData.cardNumber);
      const cardLast4 = cardData.cardNumber.slice(-4);

      // Parse expiry date
      const [month, year] = cardData.expiryDate.split('/');
      const expiryMonth = parseInt(month);
      const expiryYear = parseInt(year.length === 2 ? `20${year}` : year);

      // Create token record
      const tokenRecord = {
        token,
        encryptedData,
        cardType,
        cardBrand: cardValidation.cardBrand,
        cardLast4,
        cardBin,
        expiryMonth,
        expiryYear,
        cardholderName: cardData.cardholderName,
        cvvProvided: cardData.cvv ? true : false,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.tokenExpiry)
      };

      // If customer ID is provided, create payment method
      if (customerId) {
        const customer = await Customer.findByCustomerId(customerId);
        if (!customer) {
          throw new Error('Customer not found');
        }

        // Check if payment method already exists
        const existingMethod = await PaymentMethod.findOne({
          where: {
            customerId: customer.id,
            cardLast4,
            cardBin,
            expiryMonth,
            expiryYear
          }
        });

        if (existingMethod) {
          logger.info(`Payment method already exists for customer: ${customerId}`);
          return {
            token: existingMethod.cardToken,
            cardType: existingMethod.cardType,
            cardBrand: existingMethod.cardBrand,
            cardLast4: existingMethod.cardLast4,
            expiryDate: existingMethod.getExpiryDate(),
            existing: true
          };
        }

        // Create new payment method
        const paymentMethod = await PaymentMethod.create({
          customerId: customer.id,
          cardToken: token,
          encryptedCardData: encryptedData,
          cardType,
          cardBrand: cardValidation.cardBrand,
          cardLast4,
          cardBin,
          expiryMonth,
          expiryYear,
          cardholderName: cardData.cardholderName,
          cvvSupported: cardData.cvv ? true : false,
          status: 'active'
        });

        logger.info(`Payment method created for customer: ${customerId}`);

        return {
          token: paymentMethod.cardToken,
          cardType: paymentMethod.cardType,
          cardBrand: paymentMethod.cardBrand,
          cardLast4: paymentMethod.cardLast4,
          expiryDate: paymentMethod.getExpiryDate(),
          existing: false
        };
      }

      // Return temporary token (not stored in database)
      logger.info('Temporary card token generated');

      return {
        token,
        cardType,
        cardBrand: cardValidation.cardBrand,
        cardLast4,
        expiryDate: cardData.expiryDate,
        temporary: true,
        expiresAt: tokenRecord.expiresAt
      };

    } catch (error) {
      logger.error('Card tokenization failed:', error);
      throw error;
    }
  }

  /**
   * Get payment method by token
   * @param {string} token - Payment method token
   * @returns {object} - Payment method data
   */
  async getPaymentMethodByToken(token) {
    try {
      const paymentMethod = await PaymentMethod.findByToken(token);
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.status !== 'active') {
        throw new Error('Payment method is not active');
      }

      if (paymentMethod.isExpired()) {
        throw new Error('Payment method has expired');
      }

      return {
        id: paymentMethod.id,
        token: paymentMethod.cardToken,
        customerId: paymentMethod.customerId,
        cardType: paymentMethod.cardType,
        cardBrand: paymentMethod.cardBrand,
        cardLast4: paymentMethod.cardLast4,
        expiryDate: paymentMethod.getExpiryDate(),
        cardholderName: paymentMethod.cardholderName,
        isDefault: paymentMethod.isDefault,
        cvvSupported: paymentMethod.cvvSupported,
        createdAt: paymentMethod.createdAt
      };

    } catch (error) {
      logger.error('Failed to get payment method by token:', error);
      throw error;
    }
  }

  /**
   * Update payment method
   * @param {string} token - Payment method token
   * @param {object} updateData - Update data
   * @returns {object} - Updated payment method
   */
  async updatePaymentMethod(token, updateData) {
    try {
      const paymentMethod = await PaymentMethod.findByToken(token);
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Update allowed fields
      const allowedFields = [
        'cardholderName',
        'billingAddress',
        'billingCity',
        'billingState',
        'billingZipCode',
        'billingCountry',
        'isDefault'
      ];

      const updateFields = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields[field] = updateData[field];
        }
      }

      await paymentMethod.update(updateFields);

      logger.info(`Payment method updated: ${token}`);

      return {
        id: paymentMethod.id,
        token: paymentMethod.cardToken,
        cardType: paymentMethod.cardType,
        cardBrand: paymentMethod.cardBrand,
        cardLast4: paymentMethod.cardLast4,
        expiryDate: paymentMethod.getExpiryDate(),
        cardholderName: paymentMethod.cardholderName,
        isDefault: paymentMethod.isDefault,
        updatedAt: paymentMethod.updatedAt
      };

    } catch (error) {
      logger.error('Failed to update payment method:', error);
      throw error;
    }
  }

  /**
   * Delete payment method
   * @param {string} token - Payment method token
   * @returns {boolean} - Success status
   */
  async deletePaymentMethod(token) {
    try {
      const paymentMethod = await PaymentMethod.findByToken(token);
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Check if payment method has been used in transactions
      const Transaction = require('../models/Transaction');
      const transactionCount = await Transaction.count({
        where: { paymentMethodId: paymentMethod.id }
      });

      if (transactionCount > 0) {
        // Don't delete, just deactivate
        await paymentMethod.update({ status: 'inactive' });
        logger.info(`Payment method deactivated: ${token}`);
      } else {
        // Safe to delete
        await paymentMethod.destroy();
        logger.info(`Payment method deleted: ${token}`);
      }

      return true;

    } catch (error) {
      logger.error('Failed to delete payment method:', error);
      throw error;
    }
  }

  /**
   * Get customer payment methods
   * @param {string} customerId - Customer ID
   * @param {object} options - Query options
   * @returns {array} - Array of payment methods
   */
  async getCustomerPaymentMethods(customerId, options = {}) {
    try {
      const customer = await Customer.findByCustomerId(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const { includeInactive = false } = options;

      const whereClause = { customerId: customer.id };
      if (!includeInactive) {
        whereClause.status = 'active';
      }

      const paymentMethods = await PaymentMethod.findAll({
        where: whereClause,
        order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
      });

      return paymentMethods.map(pm => ({
        id: pm.id,
        token: pm.cardToken,
        cardType: pm.cardType,
        cardBrand: pm.cardBrand,
        cardLast4: pm.cardLast4,
        expiryDate: pm.getExpiryDate(),
        cardholderName: pm.cardholderName,
        isDefault: pm.isDefault,
        status: pm.status,
        cvvSupported: pm.cvvSupported,
        createdAt: pm.createdAt,
        lastUsed: pm.lastUsedDate
      }));

    } catch (error) {
      logger.error('Failed to get customer payment methods:', error);
      throw error;
    }
  }

  /**
   * Set default payment method
   * @param {string} customerId - Customer ID
   * @param {string} token - Payment method token
   * @returns {boolean} - Success status
   */
  async setDefaultPaymentMethod(customerId, token) {
    try {
      const customer = await Customer.findByCustomerId(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const paymentMethod = await PaymentMethod.findByToken(token);
      if (!paymentMethod || paymentMethod.customerId !== customer.id) {
        throw new Error('Payment method not found or not owned by customer');
      }

      // Update all payment methods to not default
      await PaymentMethod.update(
        { isDefault: false },
        { where: { customerId: customer.id } }
      );

      // Set the specified payment method as default
      await paymentMethod.update({ isDefault: true });

      logger.info(`Default payment method set for customer: ${customerId}`);

      return true;

    } catch (error) {
      logger.error('Failed to set default payment method:', error);
      throw error;
    }
  }

  /**
   * Validate card token
   * @param {string} token - Card token to validate
   * @returns {object} - Validation result
   */
  async validateToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        return {
          isValid: false,
          reason: 'Invalid token format'
        };
      }

      const paymentMethod = await PaymentMethod.findByToken(token);
      if (!paymentMethod) {
        return {
          isValid: false,
          reason: 'Token not found'
        };
      }

      if (paymentMethod.status !== 'active') {
        return {
          isValid: false,
          reason: 'Payment method is not active'
        };
      }

      if (paymentMethod.isExpired()) {
        return {
          isValid: false,
          reason: 'Payment method has expired'
        };
      }

      return {
        isValid: true,
        paymentMethod: {
          cardType: paymentMethod.cardType,
          cardBrand: paymentMethod.cardBrand,
          cardLast4: paymentMethod.cardLast4,
          expiryDate: paymentMethod.getExpiryDate()
        }
      };

    } catch (error) {
      logger.error('Token validation failed:', error);
      return {
        isValid: false,
        reason: 'Token validation failed'
      };
    }
  }

  /**
   * Get card metadata without decrypting
   * @param {string} token - Card token
   * @returns {object} - Card metadata
   */
  async getCardMetadata(token) {
    try {
      const paymentMethod = await PaymentMethod.findByToken(token);
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      return {
        cardType: paymentMethod.cardType,
        cardBrand: paymentMethod.cardBrand,
        cardLast4: paymentMethod.cardLast4,
        cardBin: paymentMethod.cardBin,
        expiryDate: paymentMethod.getExpiryDate(),
        cardholderName: paymentMethod.cardholderName,
        cvvSupported: paymentMethod.cvvSupported,
        isDefault: paymentMethod.isDefault,
        status: paymentMethod.status,
        createdAt: paymentMethod.createdAt,
        lastUsed: paymentMethod.lastUsedDate
      };

    } catch (error) {
      logger.error('Failed to get card metadata:', error);
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   * @returns {number} - Number of tokens cleaned up
   */
  async cleanupExpiredTokens() {
    try {
      // Find expired payment methods
      const expiredMethods = await PaymentMethod.findExpiredCards();

      let cleanedCount = 0;
      for (const method of expiredMethods) {
        // Check if method has been used in transactions
        const Transaction = require('../models/Transaction');
        const transactionCount = await Transaction.count({
          where: { paymentMethodId: method.id }
        });

        if (transactionCount > 0) {
          // Don't delete, just mark as expired
          await method.update({ status: 'expired' });
        } else {
          // Safe to delete
          await method.destroy();
        }
        cleanedCount++;
      }

      logger.info(`Cleaned up ${cleanedCount} expired payment methods`);
      return cleanedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
      throw error;
    }
  }
}

module.exports = new TokenizationService();