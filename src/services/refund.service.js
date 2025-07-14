const { logger } = require('../utils/logger');
const { 
  generateRefundId, 
  fromCents, 
  toCents, 
  validateAmount
} = require('../utils/helpers');
const { 
  TRANSACTION_STATUS, 
  RESPONSE_CODES 
} = require('../config/constants');

// Import models
const Transaction = require('../models/Transaction');
const Refund = require('../models/Refund');
const Customer = require('../models/Customer');

/**
 * Refund Service
 * Handles refund processing and management
 */
class RefundService {
  constructor() {
    this.refundFeePercentage = 0.005; // 0.5% refund fee
    this.refundFeeFixed = 0; // No fixed fee for refunds
    this.maxRefundAmount = 99999999; // $999,999.99 in cents
    this.minRefundAmount = 1; // $0.01 in cents
  }

  /**
   * Process a refund
   * @param {string} transactionId - Transaction ID to refund
   * @param {object} refundData - Refund data
   * @param {object} options - Processing options
   * @returns {object} - Refund result
   */
  async processRefund(transactionId, refundData, options = {}) {
    const startTime = Date.now();
    let refund = null;

    try {
      // Get the original transaction
      const transaction = await Transaction.findByTransactionId(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Validate refund eligibility
      const eligibilityResult = await this.validateRefundEligibility(transaction, refundData);
      if (!eligibilityResult.isEligible) {
        throw new Error(`Refund not eligible: ${eligibilityResult.reason}`);
      }

      // Calculate refund amount
      const refundAmount = refundData.amount ? 
        toCents(refundData.amount) : 
        transaction.refundableAmount;

      // Validate refund amount
      const amountValidation = this.validateRefundAmount(refundAmount, transaction);
      if (!amountValidation.isValid) {
        throw new Error(`Invalid refund amount: ${amountValidation.errors.join(', ')}`);
      }

      // Get customer
      const customer = await Customer.findByPk(transaction.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Calculate refund fee
      const refundFee = this.calculateRefundFee(refundAmount);

      // Create refund record
      refund = await Refund.create({
        transactionId: transaction.id,
        customerId: customer.id,
        amount: refundAmount,
        currency: transaction.currency,
        reason: refundData.reason || 'customer_request',
        description: refundData.description || 'Refund processed',
        status: 'pending',
        refundFee: refundFee,
        netRefundAmount: refundAmount - refundFee,
        initiatedBy: options.initiatedBy || 'customer',
        initiatedByUserId: options.initiatedByUserId,
        merchantId: transaction.merchantId,
        merchantName: transaction.merchantName,
        requiresApproval: this.requiresApproval(refundAmount, refundData.reason)
      });

      // Check if approval is required
      if (refund.requiresApproval) {
        logger.info(`Refund ${refund.refundId} requires approval`);
        return {
          success: true,
          refund: this.formatRefundResponse(refund),
          requiresApproval: true,
          message: 'Refund created and pending approval'
        };
      }

      // Process the refund
      const processingResult = await this.processRefundWithGateway(
        refund,
        transaction,
        options
      );

      // Update refund with result
      await refund.update({
        status: processingResult.status,
        gatewayResponseCode: processingResult.responseCode,
        gatewayResponseMessage: processingResult.responseMessage,
        gatewayRefundId: processingResult.gatewayRefundId,
        processingStartedAt: new Date(startTime),
        processingCompletedAt: new Date(),
        processingTimeMs: Date.now() - startTime
      });

      logger.info(`Refund processed: ${refund.refundId}, Status: ${processingResult.status}`);

      return {
        success: processingResult.status === 'completed',
        refund: this.formatRefundResponse(refund),
        requiresApproval: false,
        message: processingResult.status === 'completed' ? 
          'Refund processed successfully' : 
          `Refund failed: ${processingResult.responseMessage}`
      };

    } catch (error) {
      logger.error('Refund processing failed:', error);

      // Update refund if it exists
      if (refund) {
        await refund.update({
          status: 'failed',
          gatewayResponseMessage: error.message,
          processingCompletedAt: new Date(),
          processingTimeMs: Date.now() - startTime
        });
      }

      throw error;
    }
  }

  /**
   * Validate refund eligibility
   * @param {object} transaction - Transaction object
   * @param {object} refundData - Refund data
   * @returns {object} - Eligibility result
   */
  async validateRefundEligibility(transaction, refundData) {
    // Check if transaction is refundable
    if (!transaction.isRefundable()) {
      return {
        isEligible: false,
        reason: 'Transaction is not refundable'
      };
    }

    // Check if transaction is too old (e.g., 180 days)
    const maxRefundAge = 180 * 24 * 60 * 60 * 1000; // 180 days in milliseconds
    const transactionAge = Date.now() - transaction.createdAt.getTime();
    
    if (transactionAge > maxRefundAge) {
      return {
        isEligible: false,
        reason: 'Transaction is too old for refund'
      };
    }

    // Check if there are pending refunds
    const pendingRefunds = await Refund.findAll({
      where: {
        transactionId: transaction.id,
        status: ['pending', 'processing']
      }
    });

    if (pendingRefunds.length > 0) {
      return {
        isEligible: false,
        reason: 'There are pending refunds for this transaction'
      };
    }

    return {
      isEligible: true,
      reason: null
    };
  }

  /**
   * Validate refund amount
   * @param {number} refundAmount - Refund amount in cents
   * @param {object} transaction - Transaction object
   * @returns {object} - Validation result
   */
  validateRefundAmount(refundAmount, transaction) {
    const errors = [];

    // Validate amount range
    const amountValidation = validateAmount(refundAmount);
    if (!amountValidation.isValid) {
      errors.push(...amountValidation.errors);
    }

    // Check if amount exceeds refundable amount
    if (refundAmount > transaction.refundableAmount) {
      errors.push(`Refund amount cannot exceed refundable amount of ${fromCents(transaction.refundableAmount)}`);
    }

    // Check minimum refund amount
    if (refundAmount < this.minRefundAmount) {
      errors.push(`Refund amount must be at least ${fromCents(this.minRefundAmount)}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate refund fee
   * @param {number} refundAmount - Refund amount in cents
   * @returns {number} - Refund fee in cents
   */
  calculateRefundFee(refundAmount) {
    return Math.round(refundAmount * this.refundFeePercentage) + this.refundFeeFixed;
  }

  /**
   * Check if refund requires approval
   * @param {number} refundAmount - Refund amount in cents
   * @param {string} reason - Refund reason
   * @returns {boolean} - Whether approval is required
   */
  requiresApproval(refundAmount, reason) {
    // High-value refunds require approval
    if (refundAmount > 50000) { // $500+
      return true;
    }

    // Fraudulent transaction refunds require approval
    if (reason === 'fraudulent_transaction') {
      return true;
    }

    // Chargeback refunds require approval
    if (reason === 'chargeback') {
      return true;
    }

    return false;
  }

  /**
   * Process refund with gateway (simulated)
   * @param {object} refund - Refund object
   * @param {object} transaction - Transaction object
   * @param {object} options - Processing options
   * @returns {object} - Processing result
   */
  async processRefundWithGateway(refund, transaction, options = {}) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Simulate refund processing logic
    let status = 'completed';
    let responseCode = RESPONSE_CODES.SUCCESS;
    let responseMessage = 'Refund processed successfully';

    // Simulate failure scenarios (5% failure rate)
    if (Math.random() > 0.95) {
      status = 'failed';
      responseCode = RESPONSE_CODES.PROCESSING_ERROR;
      responseMessage = 'Refund processing failed';
    }

    // Generate gateway refund ID
    const gatewayRefundId = `rf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    return {
      status,
      responseCode,
      responseMessage,
      gatewayRefundId,
      processingTime: Date.now()
    };
  }

  /**
   * Approve a refund
   * @param {string} refundId - Refund ID
   * @param {object} approvalData - Approval data
   * @returns {object} - Approval result
   */
  async approveRefund(refundId, approvalData) {
    try {
      const refund = await Refund.findByRefundId(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (!refund.canApprove()) {
        throw new Error('Refund cannot be approved');
      }

      // Update refund with approval
      await refund.update({
        approvedBy: approvalData.approvedBy,
        approvedAt: new Date(),
        approvalNotes: approvalData.notes
      });

      // Now process the refund
      const transaction = await Transaction.findByPk(refund.transactionId);
      const processingResult = await this.processRefundWithGateway(refund, transaction);

      // Update refund with processing result
      await refund.update({
        status: processingResult.status,
        gatewayResponseCode: processingResult.responseCode,
        gatewayResponseMessage: processingResult.responseMessage,
        gatewayRefundId: processingResult.gatewayRefundId,
        processingStartedAt: new Date(),
        processingCompletedAt: new Date(),
        processingTimeMs: processingResult.processingTime
      });

      logger.info(`Refund approved and processed: ${refund.refundId}`);

      return {
        success: processingResult.status === 'completed',
        refund: this.formatRefundResponse(refund),
        message: processingResult.status === 'completed' ? 
          'Refund approved and processed successfully' : 
          `Refund processing failed: ${processingResult.responseMessage}`
      };

    } catch (error) {
      logger.error('Refund approval failed:', error);
      throw error;
    }
  }

  /**
   * Cancel a refund
   * @param {string} refundId - Refund ID
   * @param {object} cancelData - Cancel data
   * @returns {object} - Cancel result
   */
  async cancelRefund(refundId, cancelData) {
    try {
      const refund = await Refund.findByRefundId(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (!refund.canCancel()) {
        throw new Error('Refund cannot be cancelled');
      }

      // Update refund status to cancelled
      await refund.update({
        status: 'cancelled',
        gatewayResponseMessage: cancelData.reason || 'Refund cancelled',
        processingCompletedAt: new Date()
      });

      logger.info(`Refund cancelled: ${refund.refundId}`);

      return {
        success: true,
        refund: this.formatRefundResponse(refund),
        message: 'Refund cancelled successfully'
      };

    } catch (error) {
      logger.error('Refund cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Get refund by ID
   * @param {string} refundId - Refund ID
   * @returns {object} - Refund object
   */
  async getRefund(refundId) {
    const refund = await Refund.findByRefundId(refundId);
    if (!refund) {
      throw new Error('Refund not found');
    }

    return refund;
  }

  /**
   * Get refunds for a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {array} - Array of refunds
   */
  async getRefundsForTransaction(transactionId) {
    const transaction = await Transaction.findByTransactionId(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const refunds = await Refund.findByTransaction(transaction.id);
    return refunds.map(refund => this.formatRefundResponse(refund));
  }

  /**
   * Get refunds for a customer
   * @param {string} customerId - Customer ID
   * @param {object} options - Query options
   * @returns {object} - Refunds with pagination
   */
  async getRefundsForCustomer(customerId, options = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    const customer = await Customer.findByCustomerId(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const whereClause = { customerId: customer.id };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await Refund.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      refunds: rows.map(refund => this.formatRefundResponse(refund)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * Get pending refunds for approval
   * @param {object} options - Query options
   * @returns {array} - Array of pending refunds
   */
  async getPendingRefunds(options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await Refund.findAndCountAll({
      where: {
        requiresApproval: true,
        approvedAt: null,
        status: 'pending'
      },
      order: [['createdAt', 'ASC']],
      limit,
      offset
    });

    return {
      refunds: rows.map(refund => this.formatRefundResponse(refund)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * Format refund response
   * @param {object} refund - Refund object
   * @returns {object} - Formatted response
   */
  formatRefundResponse(refund) {
    return {
      id: refund.refundId,
      transactionId: refund.transactionId,
      amount: fromCents(refund.amount),
      currency: refund.currency,
      reason: refund.reason,
      description: refund.description,
      status: refund.status,
      refundType: refund.refundType,
      fee: fromCents(refund.refundFee),
      netAmount: fromCents(refund.netRefundAmount),
      initiatedBy: refund.initiatedBy,
      requiresApproval: refund.requiresApproval,
      approvedBy: refund.approvedBy,
      approvedAt: refund.approvedAt,
      processingTime: refund.processingTimeMs,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt
    };
  }
}

module.exports = new RefundService();