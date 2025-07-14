const { logger } = require('../utils/logger');
const { generateHmacSignature } = require('../utils/encryption');
const { WEBHOOK_EVENTS } = require('../config/constants');

/**
 * Notification Service
 * Handles webhook notifications and email notifications
 */
class NotificationService {
  constructor() {
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
    this.webhookTimeout = parseInt(process.env.WEBHOOK_TIMEOUT) || 30000;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
  }

  /**
   * Send webhook notification
   * @param {string} event - Event type
   * @param {object} data - Event data
   * @param {string} webhookUrl - Webhook URL
   * @param {object} options - Additional options
   * @returns {object} - Webhook result
   */
  async sendWebhook(event, data, webhookUrl, options = {}) {
    try {
      if (!webhookUrl) {
        logger.warn('No webhook URL provided, skipping webhook');
        return { success: false, reason: 'No webhook URL' };
      }

      // Create webhook payload
      const payload = {
        event,
        data,
        timestamp: new Date().toISOString(),
        api_version: '1.0'
      };

      // Generate signature
      const signature = generateHmacSignature(
        JSON.stringify(payload),
        this.webhookSecret
      );

      // Send webhook with retries
      const result = await this.sendWebhookWithRetries(
        webhookUrl,
        payload,
        signature,
        options
      );

      logger.info(`Webhook sent: ${event} to ${webhookUrl}`, {
        success: result.success,
        statusCode: result.statusCode,
        attempts: result.attempts
      });

      return result;

    } catch (error) {
      logger.error('Webhook sending failed:', error);
      return {
        success: false,
        error: error.message,
        attempts: 1
      };
    }
  }

  /**
   * Send webhook with retry logic
   * @param {string} url - Webhook URL
   * @param {object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @param {object} options - Additional options
   * @returns {object} - Webhook result
   */
  async sendWebhookWithRetries(url, payload, signature, options = {}) {
    const { timeout = this.webhookTimeout, retries = this.maxRetries } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.makeWebhookRequest(url, payload, signature, timeout);
        
        if (response.success) {
          return {
            success: true,
            statusCode: response.statusCode,
            attempts: attempt
          };
        }
        
        // If this is the last attempt, return the failure
        if (attempt === retries) {
          return {
            success: false,
            statusCode: response.statusCode,
            error: response.error,
            attempts: attempt
          };
        }
        
        // Wait before retry (exponential backoff)
        await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
        
      } catch (error) {
        logger.warn(`Webhook attempt ${attempt} failed:`, error.message);
        
        // If this is the last attempt, return the failure
        if (attempt === retries) {
          return {
            success: false,
            error: error.message,
            attempts: attempt
          };
        }
        
        // Wait before retry
        await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
      }
    }
  }

  /**
   * Make webhook HTTP request
   * @param {string} url - Webhook URL
   * @param {object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @param {number} timeout - Request timeout
   * @returns {object} - Request result
   */
  async makeWebhookRequest(url, payload, signature, timeout) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');
      const urlObj = new URL(url);
      
      const client = urlObj.protocol === 'https:' ? https : http;
      const postData = JSON.stringify(payload);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-Webhook-Signature': signature,
          'User-Agent': 'BOOM-Payment-Gateway/1.0'
        },
        timeout: timeout
      };

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          resolve({
            success,
            statusCode: res.statusCode,
            response: responseData,
            error: success ? null : `HTTP ${res.statusCode}`
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Send payment completed notification
   * @param {object} transaction - Transaction object
   * @param {string} webhookUrl - Webhook URL
   * @returns {object} - Notification result
   */
  async sendPaymentCompletedNotification(transaction, webhookUrl) {
    const eventData = {
      transaction_id: transaction.transactionId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      customer_id: transaction.customerId,
      payment_method: {
        type: transaction.paymentMethod?.cardType,
        last4: transaction.paymentMethod?.cardLast4
      },
      risk_level: transaction.riskLevel,
      cvv_provided: transaction.cvvProvided,
      created_at: transaction.createdAt,
      completed_at: transaction.processingCompletedAt
    };

    return await this.sendWebhook(
      WEBHOOK_EVENTS.PAYMENT_COMPLETED,
      eventData,
      webhookUrl
    );
  }

  /**
   * Send payment failed notification
   * @param {object} transaction - Transaction object
   * @param {string} webhookUrl - Webhook URL
   * @returns {object} - Notification result
   */
  async sendPaymentFailedNotification(transaction, webhookUrl) {
    const eventData = {
      transaction_id: transaction.transactionId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      customer_id: transaction.customerId,
      error_code: transaction.gatewayResponseCode,
      error_message: transaction.gatewayResponseMessage,
      risk_level: transaction.riskLevel,
      cvv_provided: transaction.cvvProvided,
      created_at: transaction.createdAt,
      failed_at: transaction.processingCompletedAt
    };

    return await this.sendWebhook(
      WEBHOOK_EVENTS.PAYMENT_FAILED,
      eventData,
      webhookUrl
    );
  }

  /**
   * Send refund notification
   * @param {object} refund - Refund object
   * @param {string} webhookUrl - Webhook URL
   * @returns {object} - Notification result
   */
  async sendRefundNotification(refund, webhookUrl) {
    const eventData = {
      refund_id: refund.refundId,
      transaction_id: refund.transactionId,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      customer_id: refund.customerId,
      refund_type: refund.refundType,
      created_at: refund.createdAt,
      completed_at: refund.processingCompletedAt
    };

    return await this.sendWebhook(
      WEBHOOK_EVENTS.PAYMENT_REFUNDED,
      eventData,
      webhookUrl
    );
  }

  /**
   * Send customer created notification
   * @param {object} customer - Customer object
   * @param {string} webhookUrl - Webhook URL
   * @returns {object} - Notification result
   */
  async sendCustomerCreatedNotification(customer, webhookUrl) {
    const eventData = {
      customer_id: customer.customerId,
      email: customer.email,
      name: customer.getFullName(),
      status: customer.status,
      risk_level: customer.riskLevel,
      created_at: customer.createdAt
    };

    return await this.sendWebhook(
      WEBHOOK_EVENTS.CUSTOMER_CREATED,
      eventData,
      webhookUrl
    );
  }

  /**
   * Send email notification (simulated)
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} template - Email template
   * @param {object} data - Template data
   * @returns {object} - Email result
   */
  async sendEmail(to, subject, template, data) {
    try {
      // In a real implementation, you would integrate with an email service
      // like SendGrid, AWS SES, or similar
      
      logger.info(`Email sent to ${to}`, {
        subject,
        template,
        data
      });

      // Simulate email sending
      await this.sleep(500);

      return {
        success: true,
        messageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      };

    } catch (error) {
      logger.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send payment receipt email
   * @param {object} transaction - Transaction object
   * @param {object} customer - Customer object
   * @returns {object} - Email result
   */
  async sendPaymentReceiptEmail(transaction, customer) {
    const emailData = {
      customerName: customer.getFullName(),
      transactionId: transaction.transactionId,
      amount: transaction.getFormattedAmount(),
      currency: transaction.currency,
      date: transaction.createdAt,
      cardLast4: transaction.paymentMethod?.cardLast4,
      cardType: transaction.paymentMethod?.cardType
    };

    return await this.sendEmail(
      customer.email,
      'Payment Receipt',
      'payment_receipt',
      emailData
    );
  }

  /**
   * Send refund confirmation email
   * @param {object} refund - Refund object
   * @param {object} customer - Customer object
   * @returns {object} - Email result
   */
  async sendRefundConfirmationEmail(refund, customer) {
    const emailData = {
      customerName: customer.getFullName(),
      refundId: refund.refundId,
      transactionId: refund.transactionId,
      amount: refund.getFormattedAmount(),
      currency: refund.currency,
      reason: refund.getReasonDisplayName(),
      date: refund.createdAt
    };

    return await this.sendEmail(
      customer.email,
      'Refund Confirmation',
      'refund_confirmation',
      emailData
    );
  }

  /**
   * Send payment failure notification email
   * @param {object} transaction - Transaction object
   * @param {object} customer - Customer object
   * @returns {object} - Email result
   */
  async sendPaymentFailureEmail(transaction, customer) {
    const emailData = {
      customerName: customer.getFullName(),
      transactionId: transaction.transactionId,
      amount: transaction.getFormattedAmount(),
      currency: transaction.currency,
      errorMessage: transaction.gatewayResponseMessage,
      date: transaction.createdAt
    };

    return await this.sendEmail(
      customer.email,
      'Payment Failed',
      'payment_failure',
      emailData
    );
  }

  /**
   * Queue notification for processing
   * @param {string} type - Notification type
   * @param {object} data - Notification data
   * @param {object} options - Processing options
   * @returns {string} - Queue ID
   */
  async queueNotification(type, data, options = {}) {
    // In a real implementation, you would use a queue system like Redis, RabbitMQ, etc.
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    logger.info(`Notification queued: ${type}`, {
      queueId,
      data,
      options
    });

    // Simulate queue processing
    setTimeout(async () => {
      try {
        await this.processQueuedNotification(type, data, options);
        logger.info(`Queued notification processed: ${queueId}`);
      } catch (error) {
        logger.error(`Queued notification failed: ${queueId}`, error);
      }
    }, 1000);

    return queueId;
  }

  /**
   * Process queued notification
   * @param {string} type - Notification type
   * @param {object} data - Notification data
   * @param {object} options - Processing options
   */
  async processQueuedNotification(type, data, options) {
    switch (type) {
      case 'webhook':
        await this.sendWebhook(data.event, data.payload, data.url, options);
        break;
      case 'email':
        await this.sendEmail(data.to, data.subject, data.template, data.data);
        break;
      default:
        logger.warn(`Unknown notification type: ${type}`);
    }
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Promise that resolves after delay
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate webhook signature
   * @param {string} payload - Webhook payload
   * @param {string} signature - Provided signature
   * @returns {boolean} - Validation result
   */
  validateWebhookSignature(payload, signature) {
    try {
      const expectedSignature = generateHmacSignature(payload, this.webhookSecret);
      return signature === expectedSignature;
    } catch (error) {
      logger.error('Webhook signature validation failed:', error);
      return false;
    }
  }

  /**
   * Get webhook events
   * @returns {array} - Array of supported webhook events
   */
  getSupportedEvents() {
    return Object.values(WEBHOOK_EVENTS);
  }
}

module.exports = new NotificationService();