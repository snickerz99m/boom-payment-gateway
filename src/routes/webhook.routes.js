const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

// Webhook handler
router.post('/payment', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    logger.info(`Webhook received: ${event}`, data);
    
    // Process webhook based on event type
    switch (event) {
      case 'payment.completed':
        // Handle successful payment
        break;
      case 'payment.failed':
        // Handle failed payment
        break;
      default:
        logger.warn(`Unknown webhook event: ${event}`);
    }
    
    res.json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      code: 'WEBHOOK_ERROR'
    });
  }
});

module.exports = router;