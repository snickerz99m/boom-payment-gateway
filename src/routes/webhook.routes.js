const express = require('express');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { notificationService } = require('../services/notification.service');
const StripeService = require('../services/stripe.service');
const PayPalService = require('../services/paypal.service');

const router = express.Router();

// Initialize payment services
const stripeService = new StripeService();
const paypalService = new PayPalService();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(401).json({
        success: false,
        message: 'Missing Stripe signature'
      });
    }

    const result = await stripeService.handleWebhook(req.body, signature);
    
    if (result.success) {
      res.json({ received: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PayPal webhook endpoint
router.post('/paypal', express.json(), async (req, res) => {
  try {
    const result = await paypalService.handleWebhook(req.body, req.headers);
    
    if (result.success) {
      res.json({ received: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('PayPal webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-boom-signature'];
  const webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-change-this';
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature'
    });
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }
  
  next();
};

// Payment webhook endpoint
router.post('/payment', verifyWebhookSignature, async (req, res) => {
  try {
    const { event, data } = req.body;
    
    logger.info(`Payment webhook received: ${event}`, data);
    
    // Handle different payment events
    switch (event) {
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      case 'payment.refunded':
        await handlePaymentRefunded(data);
        break;
      case 'payment.disputed':
        await handlePaymentDisputed(data);
        break;
      default:
        logger.warn(`Unknown payment event: ${event}`);
    }
    
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    logger.error('Payment webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// Customer webhook endpoint
router.post('/customer', verifyWebhookSignature, async (req, res) => {
  try {
    const { event, data } = req.body;
    
    logger.info(`Customer webhook received: ${event}`, data);
    
    // Handle different customer events
    switch (event) {
      case 'customer.created':
        await handleCustomerCreated(data);
        break;
      case 'customer.updated':
        await handleCustomerUpdated(data);
        break;
      case 'customer.deleted':
        await handleCustomerDeleted(data);
        break;
      default:
        logger.warn(`Unknown customer event: ${event}`);
    }
    
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    logger.error('Customer webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// Test webhook endpoint
router.post('/test', async (req, res) => {
  try {
    logger.info('Test webhook received:', req.body);
    
    res.json({
      success: true,
      message: 'Test webhook received successfully',
      timestamp: new Date().toISOString(),
      data: req.body
    });
    
  } catch (error) {
    logger.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Test webhook processing failed'
    });
  }
});

// Webhook event handlers
async function handlePaymentCompleted(data) {
  try {
    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({
      where: { transactionId: data.transactionId }
    });
    
    if (transaction) {
      await transaction.update({
        status: 'completed',
        processingCompletedAt: new Date(),
        gatewayResponseCode: data.responseCode || 'success',
        gatewayResponseMessage: data.responseMessage || 'Payment completed successfully'
      });
      
      // Send notification
      await notificationService.sendPaymentCompletedNotification(transaction);
    }
    
    logger.info(`Payment completed: ${data.transactionId}`);
  } catch (error) {
    logger.error('Handle payment completed error:', error);
  }
}

async function handlePaymentFailed(data) {
  try {
    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({
      where: { transactionId: data.transactionId }
    });
    
    if (transaction) {
      await transaction.update({
        status: 'failed',
        gatewayResponseCode: data.responseCode || 'failed',
        gatewayResponseMessage: data.responseMessage || 'Payment failed'
      });
      
      // Send notification
      await notificationService.sendPaymentFailedNotification(transaction);
    }
    
    logger.info(`Payment failed: ${data.transactionId}`);
  } catch (error) {
    logger.error('Handle payment failed error:', error);
  }
}

async function handlePaymentRefunded(data) {
  try {
    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({
      where: { transactionId: data.transactionId }
    });
    
    if (transaction) {
      await transaction.update({
        status: data.refundAmount >= transaction.amount ? 'refunded' : 'partially_refunded',
        refundedAmount: data.refundAmount
      });
      
      // Send notification
      await notificationService.sendPaymentRefundedNotification(transaction);
    }
    
    logger.info(`Payment refunded: ${data.transactionId}`);
  } catch (error) {
    logger.error('Handle payment refunded error:', error);
  }
}

async function handlePaymentDisputed(data) {
  try {
    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({
      where: { transactionId: data.transactionId }
    });
    
    if (transaction) {
      await transaction.update({
        metadata: {
          ...transaction.metadata,
          disputed: true,
          disputeReason: data.reason,
          disputeDate: new Date()
        }
      });
      
      // Send notification
      await notificationService.sendPaymentDisputedNotification(transaction);
    }
    
    logger.info(`Payment disputed: ${data.transactionId}`);
  } catch (error) {
    logger.error('Handle payment disputed error:', error);
  }
}

async function handleCustomerCreated(data) {
  try {
    logger.info(`Customer created: ${data.customerId}`);
    // Handle customer creation logic
  } catch (error) {
    logger.error('Handle customer created error:', error);
  }
}

async function handleCustomerUpdated(data) {
  try {
    logger.info(`Customer updated: ${data.customerId}`);
    // Handle customer update logic
  } catch (error) {
    logger.error('Handle customer updated error:', error);
  }
}

async function handleCustomerDeleted(data) {
  try {
    logger.info(`Customer deleted: ${data.customerId}`);
    // Handle customer deletion logic
  } catch (error) {
    logger.error('Handle customer deleted error:', error);
  }
}

module.exports = router;