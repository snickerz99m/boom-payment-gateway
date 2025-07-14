const express = require('express');
const { body, validationResult } = require('express-validator');
const paymentService = require('../services/payment.service');
const { logger } = require('../utils/logger');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Create payment endpoint
router.post('/', [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'CAD']).withMessage('Invalid currency'),
  body('card_number').isLength({ min: 13, max: 19 }).withMessage('Invalid card number'),
  body('expiry_month').isInt({ min: 1, max: 12 }).withMessage('Invalid expiry month'),
  body('expiry_year').isInt({ min: new Date().getFullYear() }).withMessage('Invalid expiry year'),
  body('cvv').optional().isLength({ min: 3, max: 4 }).withMessage('Invalid CVV'),
  body('customer_id').isUUID().withMessage('Invalid customer ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const payment = await paymentService.processPayment(req.body);
    
    logger.info(`Payment processed successfully: ${payment.id}`);
    
    res.status(201).json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        created_at: payment.created_at
      }
    });
  } catch (error) {
    logger.error('Payment processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
      message: error.message
    });
  }
});

// Get payment details
router.get('/:id', authMiddleware.authenticate(), async (req, res) => {
  try {
    const payment = await paymentService.getPayment(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      payment
    });
  } catch (error) {
    logger.error('Failed to retrieve payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment',
      message: error.message
    });
  }
});

// Refund payment
router.post('/:id/refund', [
  authMiddleware.authenticate(),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Refund amount must be at least 0.01'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const refund = await paymentService.refundPayment(req.params.id, req.body);
    
    logger.info(`Refund processed successfully: ${refund.id}`);
    
    res.status(201).json({
      success: true,
      refund
    });
  } catch (error) {
    logger.error('Refund processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Refund processing failed',
      message: error.message
    });
  }
});

module.exports = router;