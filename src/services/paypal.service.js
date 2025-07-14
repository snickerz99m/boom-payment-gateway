const paypal = require('@paypal/checkout-server-sdk');
const { logger } = require('../utils/logger');

class PayPalService {
  constructor() {
    this.client = null;
    this.mode = process.env.PAYMENT_MODE || 'test';
    this.initialized = false;
  }

  /**
   * Initialize PayPal client
   */
  initialize() {
    try {
      const clientId = this.mode === 'live' 
        ? process.env.PAYPAL_CLIENT_ID_LIVE 
        : process.env.PAYPAL_CLIENT_ID_TEST;

      const clientSecret = this.mode === 'live' 
        ? process.env.PAYPAL_CLIENT_SECRET_LIVE 
        : process.env.PAYPAL_CLIENT_SECRET_TEST;

      if (!clientId || !clientSecret) {
        logger.warn('PayPal credentials not configured. Using sandbox mode.');
        // Use sandbox credentials for development
        const environment = new paypal.core.SandboxEnvironment(
          'demo_client_id',
          'demo_client_secret'
        );
        this.client = new paypal.core.PayPalHttpClient(environment);
        this.initialized = true;
        return;
      }

      const environment = this.mode === 'live' 
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);

      this.client = new paypal.core.PayPalHttpClient(environment);
      this.initialized = true;
      logger.info(`PayPal initialized in ${this.mode} mode`);
    } catch (error) {
      logger.error('Failed to initialize PayPal:', error);
      throw new Error('PayPal initialization failed');
    }
  }

  /**
   * Process payment with PayPal
   */
  async processPayment(paymentData) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const { amount, currency, cardData, customerData, description } = paymentData;

      // Create order
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: (amount / 100).toFixed(2) // Convert from cents to dollars
          },
          description: description || 'Payment'
        }],
        payer: {
          name: {
            given_name: customerData.firstName,
            surname: customerData.lastName
          },
          email_address: customerData.email
        },
        payment_source: {
          card: {
            number: cardData.cardNumber,
            expiry: cardData.expiryDate.replace('/', ''),
            security_code: cardData.cvv,
            name: cardData.cardholderName
          }
        }
      });

      const order = await this.client.execute(request);

      // Capture payment
      const captureRequest = new paypal.orders.OrdersCaptureRequest(order.result.id);
      captureRequest.requestBody({});

      const capture = await this.client.execute(captureRequest);

      logger.info(`PayPal payment processed: ${capture.result.id}`);

      return {
        success: true,
        transactionId: capture.result.id,
        status: this.mapPayPalStatus(capture.result.status),
        amount: amount,
        currency: currency,
        gatewayResponse: {
          responseCode: capture.result.status === 'COMPLETED' ? '00' : '01',
          responseMessage: capture.result.status === 'COMPLETED' ? 'Payment successful' : 'Payment failed',
          gatewayTransactionId: capture.result.id,
          orderId: order.result.id
        },
        paymentMethod: {
          brand: 'paypal',
          last4: '****',
          expMonth: null,
          expYear: null,
          funding: 'paypal'
        }
      };

    } catch (error) {
      logger.error('PayPal payment processing failed:', error);
      
      return {
        success: false,
        error: error.message,
        code: 'PAYPAL_ERROR',
        gatewayResponse: {
          responseCode: '01',
          responseMessage: error.message,
          gatewayTransactionId: null
        }
      };
    }
  }

  /**
   * Process refund
   */
  async processRefund(transactionId, amount = null) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const request = new paypal.payments.CapturesRefundRequest(transactionId);
      request.requestBody({
        amount: amount ? {
          currency_code: 'USD',
          value: (amount / 100).toFixed(2)
        } : undefined
      });

      const refund = await this.client.execute(request);

      logger.info(`PayPal refund processed: ${refund.result.id}`);

      return {
        success: true,
        refundId: refund.result.id,
        status: refund.result.status,
        amount: Math.round(parseFloat(refund.result.amount.value) * 100),
        currency: refund.result.amount.currency_code,
        gatewayResponse: {
          responseCode: '00',
          responseMessage: 'Refund successful',
          gatewayRefundId: refund.result.id
        }
      };

    } catch (error) {
      logger.error('PayPal refund processing failed:', error);
      
      return {
        success: false,
        error: error.message,
        code: 'PAYPAL_REFUND_ERROR',
        gatewayResponse: {
          responseCode: '01',
          responseMessage: error.message,
          gatewayRefundId: null
        }
      };
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(body, headers) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      // PayPal webhook verification would go here
      const event = JSON.parse(body);
      
      logger.info(`PayPal webhook received: ${event.event_type}`);

      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentSuccess(event.resource);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentFailure(event.resource);
          break;
        case 'CUSTOMER.DISPUTE.CREATED':
          await this.handleDispute(event.resource);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event.event_type}`);
      }

      return { success: true };

    } catch (error) {
      logger.error('PayPal webhook processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Map PayPal status to internal status
   */
  mapPayPalStatus(paypalStatus) {
    const statusMap = {
      'COMPLETED': 'completed',
      'PENDING': 'pending',
      'DECLINED': 'failed',
      'VOIDED': 'cancelled'
    };

    return statusMap[paypalStatus] || 'unknown';
  }

  /**
   * Handle payment success webhook
   */
  async handlePaymentSuccess(capture) {
    logger.info(`PayPal payment succeeded: ${capture.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Handle payment failure webhook
   */
  async handlePaymentFailure(capture) {
    logger.info(`PayPal payment failed: ${capture.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Handle dispute webhook
   */
  async handleDispute(dispute) {
    logger.info(`PayPal dispute created: ${dispute.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(captureId) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const request = new paypal.payments.CapturesGetRequest(captureId);
      const capture = await this.client.execute(request);
      
      return {
        success: true,
        data: {
          id: capture.result.id,
          amount: Math.round(parseFloat(capture.result.amount.value) * 100),
          currency: capture.result.amount.currency_code,
          status: capture.result.status,
          created: capture.result.create_time,
          description: capture.result.invoice_id
        }
      };

    } catch (error) {
      logger.error('Failed to get PayPal payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PayPalService;