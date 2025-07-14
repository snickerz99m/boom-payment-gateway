const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { generateApiResponse, generateErrorResponse, toCents, fromCents } = require('../utils/helpers');
const BankAccount = require('../models/BankAccount');
const Payout = require('../models/Payout');

// Get all payouts
router.get('/', async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let payouts;
    if (status === 'completed' && startDate && endDate) {
      payouts = await Payout.getCompletedPayouts(new Date(startDate), new Date(endDate));
    } else if (status === 'pending') {
      payouts = await Payout.getPendingPayouts();
    } else if (status === 'failed') {
      payouts = await Payout.getFailedPayouts();
    } else {
      // Get all payouts with pagination
      const offset = (page - 1) * limit;
      payouts = await Payout.findAll({
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [{
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['accountId', 'accountHolderName', 'bankName']
        }]
      });
    }
    
    const formattedPayouts = payouts.map(payout => ({
      id: payout.id,
      payoutId: payout.payoutId,
      amount: payout.getFormattedAmount(),
      currency: payout.currency,
      fee: payout.getFormattedFee(),
      netAmount: payout.getFormattedNetAmount(),
      status: payout.status,
      payoutType: payout.payoutType,
      description: payout.description,
      bankAccount: payout.bankAccount ? {
        accountId: payout.bankAccount.accountId,
        accountHolderName: payout.bankAccount.accountHolderName,
        bankName: payout.bankAccount.bankName
      } : null,
      transactionCount: payout.transactionCount,
      processingStartedAt: payout.processingStartedAt,
      processingCompletedAt: payout.processingCompletedAt,
      failureReason: payout.failureReason,
      retryCount: payout.retryCount,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt
    }));
    
    res.json(generateApiResponse(true, { payouts: formattedPayouts }));
  } catch (error) {
    logger.error('Failed to fetch payouts:', error);
    res.status(500).json(generateErrorResponse('Failed to fetch payouts', 'FETCH_ERROR'));
  }
});

// Get payout by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payout = await Payout.findByPk(id, {
      include: [{
        model: BankAccount,
        as: 'bankAccount',
        attributes: ['accountId', 'accountHolderName', 'bankName']
      }]
    });
    
    if (!payout) {
      return res.status(404).json(generateErrorResponse('Payout not found', 'NOT_FOUND'));
    }
    
    res.json(generateApiResponse(true, {
      payout: {
        id: payout.id,
        payoutId: payout.payoutId,
        amount: payout.getFormattedAmount(),
        currency: payout.currency,
        fee: payout.getFormattedFee(),
        netAmount: payout.getFormattedNetAmount(),
        status: payout.status,
        payoutType: payout.payoutType,
        description: payout.description,
        bankAccount: payout.bankAccount ? {
          accountId: payout.bankAccount.accountId,
          accountHolderName: payout.bankAccount.accountHolderName,
          bankName: payout.bankAccount.bankName
        } : null,
        transactionIds: payout.transactionIds,
        transactionCount: payout.transactionCount,
        processingStartedAt: payout.processingStartedAt,
        processingCompletedAt: payout.processingCompletedAt,
        processingTimeMs: payout.processingTimeMs,
        gatewayResponseCode: payout.gatewayResponseCode,
        gatewayResponseMessage: payout.gatewayResponseMessage,
        failureReason: payout.failureReason,
        failureCode: payout.failureCode,
        retryCount: payout.retryCount,
        canRetry: payout.canRetry(),
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt
      }
    }));
  } catch (error) {
    logger.error('Failed to fetch payout:', error);
    res.status(500).json(generateErrorResponse('Failed to fetch payout', 'FETCH_ERROR'));
  }
});

// Create manual payout
router.post('/', async (req, res) => {
  try {
    const {
      amount,
      currency = 'USD',
      description,
      bankAccountId,
      transactionIds = []
    } = req.body;
    
    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json(generateErrorResponse(
        'Valid amount is required',
        'VALIDATION_ERROR'
      ));
    }
    
    // Get bank account
    let bankAccount;
    if (bankAccountId) {
      bankAccount = await BankAccount.findByPk(bankAccountId);
      if (!bankAccount) {
        return res.status(404).json(generateErrorResponse('Bank account not found', 'NOT_FOUND'));
      }
    } else {
      bankAccount = await BankAccount.getDefaultAccount();
      if (!bankAccount) {
        return res.status(404).json(generateErrorResponse('No default bank account found', 'NOT_FOUND'));
      }
    }
    
    // Check if account is eligible for payout
    const amountInCents = toCents(amount);
    if (!bankAccount.isEligibleForPayout(amountInCents)) {
      return res.status(400).json(generateErrorResponse(
        'Bank account is not eligible for payout or amount is below minimum',
        'VALIDATION_ERROR'
      ));
    }
    
    // Calculate processing fee (example: 1% or $0.25, whichever is higher)
    const processingFee = Math.max(Math.round(amountInCents * 0.01), 25);
    
    // Create payout
    const payout = await Payout.create({
      bankAccountId: bankAccount.id,
      amount: amountInCents,
      currency,
      description,
      payoutType: 'manual',
      processingFee,
      transactionIds,
      transactionCount: transactionIds.length
    });
    
    logger.info(`Manual payout created: ${payout.payoutId} - Amount: ${amount} ${currency}`);
    
    res.status(201).json(generateApiResponse(true, {
      payout: {
        id: payout.id,
        payoutId: payout.payoutId,
        amount: payout.getFormattedAmount(),
        currency: payout.currency,
        fee: payout.getFormattedFee(),
        netAmount: payout.getFormattedNetAmount(),
        status: payout.status,
        payoutType: payout.payoutType,
        description: payout.description,
        bankAccount: {
          accountId: bankAccount.accountId,
          accountHolderName: bankAccount.accountHolderName,
          bankName: bankAccount.bankName
        },
        transactionCount: payout.transactionCount,
        createdAt: payout.createdAt
      }
    }, 'Payout created successfully'));
  } catch (error) {
    logger.error('Failed to create payout:', error);
    res.status(500).json(generateErrorResponse('Failed to create payout', 'CREATE_ERROR'));
  }
});

// Process payout
router.post('/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payout = await Payout.findByPk(id, {
      include: [{
        model: BankAccount,
        as: 'bankAccount'
      }]
    });
    
    if (!payout) {
      return res.status(404).json(generateErrorResponse('Payout not found', 'NOT_FOUND'));
    }
    
    if (payout.status !== 'pending') {
      return res.status(400).json(generateErrorResponse(
        'Only pending payouts can be processed',
        'VALIDATION_ERROR'
      ));
    }
    
    // Mark as processing
    await payout.markAsProcessing();
    
    try {
      // Simulate payout processing (in a real implementation, this would call the bank API)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
      
      // For demonstration, we'll simulate a successful payout
      // In a real implementation, this would integrate with banking APIs like:
      // - Stripe Connect
      // - PayPal Payouts
      // - Bank ACH transfers
      // - etc.
      
      const gatewayResponse = {
        code: 'SUCCESS',
        message: 'Payout processed successfully',
        payoutId: `bank_${Date.now()}`
      };
      
      await payout.markAsCompleted(gatewayResponse);
      
      // Update bank account statistics
      const bankAccount = payout.bankAccount;
      bankAccount.totalPayouts += 1;
      bankAccount.totalPayoutAmount += payout.amount;
      bankAccount.lastPayoutDate = new Date();
      await bankAccount.save();
      
      logger.info(`Payout processed successfully: ${payout.payoutId}`);
      
      res.json(generateApiResponse(true, {
        payout: {
          id: payout.id,
          payoutId: payout.payoutId,
          status: payout.status,
          processingStartedAt: payout.processingStartedAt,
          processingCompletedAt: payout.processingCompletedAt,
          processingTimeMs: payout.processingTimeMs,
          gatewayResponseCode: payout.gatewayResponseCode,
          gatewayResponseMessage: payout.gatewayResponseMessage,
          gatewayPayoutId: payout.gatewayPayoutId
        }
      }, 'Payout processed successfully'));
      
    } catch (processingError) {
      await payout.markAsFailed(processingError.message, 'PROCESSING_ERROR');
      
      logger.error(`Payout processing failed: ${payout.payoutId}`, processingError);
      
      return res.status(500).json(generateErrorResponse(
        'Payout processing failed',
        'PROCESSING_ERROR',
        { payoutId: payout.payoutId }
      ));
    }
    
  } catch (error) {
    logger.error('Failed to process payout:', error);
    res.status(500).json(generateErrorResponse('Failed to process payout', 'PROCESSING_ERROR'));
  }
});

// Retry failed payout
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payout = await Payout.findByPk(id);
    if (!payout) {
      return res.status(404).json(generateErrorResponse('Payout not found', 'NOT_FOUND'));
    }
    
    if (!payout.canRetry()) {
      return res.status(400).json(generateErrorResponse(
        'Payout cannot be retried',
        'VALIDATION_ERROR'
      ));
    }
    
    // Reset payout status to pending
    payout.status = 'pending';
    payout.failureReason = null;
    payout.failureCode = null;
    payout.nextRetryAt = null;
    payout.processingStartedAt = null;
    payout.processingCompletedAt = null;
    payout.processingTimeMs = null;
    await payout.save();
    
    logger.info(`Payout retry initiated: ${payout.payoutId}`);
    
    res.json(generateApiResponse(true, {
      payout: {
        id: payout.id,
        payoutId: payout.payoutId,
        status: payout.status,
        retryCount: payout.retryCount
      }
    }, 'Payout retry initiated'));
  } catch (error) {
    logger.error('Failed to retry payout:', error);
    res.status(500).json(generateErrorResponse('Failed to retry payout', 'RETRY_ERROR'));
  }
});

// Cancel payout
router.post('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payout = await Payout.findByPk(id);
    if (!payout) {
      return res.status(404).json(generateErrorResponse('Payout not found', 'NOT_FOUND'));
    }
    
    if (payout.status !== 'pending') {
      return res.status(400).json(generateErrorResponse(
        'Only pending payouts can be cancelled',
        'VALIDATION_ERROR'
      ));
    }
    
    payout.status = 'cancelled';
    await payout.save();
    
    logger.info(`Payout cancelled: ${payout.payoutId}`);
    
    res.json(generateApiResponse(true, null, 'Payout cancelled successfully'));
  } catch (error) {
    logger.error('Failed to cancel payout:', error);
    res.status(500).json(generateErrorResponse('Failed to cancel payout', 'CANCEL_ERROR'));
  }
});

// Get payout statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get basic counts
    const pendingCount = await Payout.count({ where: { status: 'pending' } });
    const processingCount = await Payout.count({ where: { status: 'processing' } });
    const completedCount = await Payout.count({ where: { status: 'completed' } });
    const failedCount = await Payout.count({ where: { status: 'failed' } });
    
    // Get total amounts
    const { Op } = require('sequelize');
    const { sequelize } = require('../config/database');
    
    const where = { status: 'completed' };
    if (startDate && endDate) {
      where.processingCompletedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    const totalAmountResult = await Payout.findAll({
      where,
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
        [sequelize.fn('SUM', sequelize.col('processing_fee')), 'totalFees'],
        [sequelize.fn('SUM', sequelize.col('net_amount')), 'totalNetAmount']
      ],
      raw: true
    });
    
    const totalAmount = totalAmountResult[0].totalAmount || 0;
    const totalFees = totalAmountResult[0].totalFees || 0;
    const totalNetAmount = totalAmountResult[0].totalNetAmount || 0;
    
    res.json(generateApiResponse(true, {
      summary: {
        counts: {
          pending: pendingCount,
          processing: processingCount,
          completed: completedCount,
          failed: failedCount,
          total: pendingCount + processingCount + completedCount + failedCount
        },
        amounts: {
          totalAmount: fromCents(totalAmount),
          totalFees: fromCents(totalFees),
          totalNetAmount: fromCents(totalNetAmount)
        }
      }
    }));
  } catch (error) {
    logger.error('Failed to fetch payout statistics:', error);
    res.status(500).json(generateErrorResponse('Failed to fetch payout statistics', 'FETCH_ERROR'));
  }
});

module.exports = router;