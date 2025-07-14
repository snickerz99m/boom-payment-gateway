const express = require('express');
const { paymentValidators } = require('../validators/payment.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const paymentService = require('../services/payment.service');
const { logger } = require('../utils/logger');

const router = express.Router();

// Process payment endpoint (no auth required for easier integration)
router.post('/process', validate(paymentValidators.processPayment), async (req, res) => {
  try {
    const result = await paymentService.processPayment(req.body);
    
    res.json({
      success: true,
      data: result,
      message: 'Payment processed successfully'
    });
    
  } catch (error) {
    logger.error('Payment processing error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment processing failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Process payment endpoint with API key authentication (for production)
router.post('/process-secure', [
  (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = (process.env.API_KEYS || '').split(',').filter(key => key.trim());
    
    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or missing API key',
        error: 'AUTHENTICATION_ERROR'
      });
    }
    
    next();
  },
  validate(paymentValidators.processPayment)
], async (req, res) => {
  try {
    const result = await paymentService.processPayment(req.body);
    
    res.json({
      success: true,
      data: result,
      message: 'Payment processed successfully'
    });
    
  } catch (error) {
    logger.error('Payment processing error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment processing failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get payment by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      data: payment
    });
    
  } catch (error) {
    logger.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// List payments with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customerId } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (customerId) filters.customerId = customerId;
    
    const result = await paymentService.getPayments({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });
    
    res.json({
      success: true,
      data: result.payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Refund payment
router.post('/:id/refund', authenticate, validate(paymentValidators.refundPayment), async (req, res) => {
  try {
    const result = await paymentService.refundPayment(req.params.id, req.body);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Payment refund error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment refund failed'
    });
  }
});

// Cancel payment
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const result = await paymentService.cancelPayment(req.params.id);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('Payment cancellation error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment cancellation failed'
    });
  }
});

module.exports = router;