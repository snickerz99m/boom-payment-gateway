const stripe = require('stripe');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

class StripeService {
  constructor() {
    this.stripe = null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.mode = process.env.PAYMENT_MODE || 'test';
    this.initialized = false;
  }

  /**
   * Initialize Stripe with API keys
   */
  initialize() {
    try {
      const apiKey = this.mode === 'live' 
        ? process.env.STRIPE_SECRET_KEY_LIVE 
        : process.env.STRIPE_SECRET_KEY_TEST;

      if (!apiKey) {
        logger.warn('Stripe API key not configured. Using test mode.');
        // Use test key for development
        this.stripe = stripe('sk_test_51234567890123456789012345678901234567890123456789012345678901234567890123456789');
        this.initialized = true;
        return;
      }

      this.stripe = stripe(apiKey);
      this.initialized = true;
      logger.info(`Stripe initialized in ${this.mode} mode`);
    } catch (error) {
      logger.error('Failed to initialize Stripe:', error);
      throw new Error('Stripe initialization failed');
    }
  }

  /**
   * Process payment with Stripe
   */
  async processPayment(paymentData) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const { amount, currency, cardData, customerData, description } = paymentData;

      // Create payment method
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: cardData.cardNumber,
          exp_month: parseInt(cardData.expiryDate.split('/')[0]),
          exp_year: parseInt(cardData.expiryDate.split('/')[1]),
          cvc: cardData.cvv
        },
        billing_details: {
          name: cardData.cardholderName,
          email: customerData.email
        }
      });

      // Create customer
      const customer = await this.stripe.customers.create({
        name: `${customerData.firstName} ${customerData.lastName}`,
        email: customerData.email,
        payment_method: paymentMethod.id
      });

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount, // Amount in cents
        currency: currency.toLowerCase(),
        customer: customer.id,
        payment_method: paymentMethod.id,
        description: description || 'Payment',
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      });

      logger.info(`Stripe payment processed: ${paymentIntent.id}`);

      return {
        success: true,
        transactionId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        gatewayResponse: {
          responseCode: paymentIntent.status === 'succeeded' ? '00' : '01',
          responseMessage: paymentIntent.status === 'succeeded' ? 'Payment successful' : 'Payment failed',
          gatewayTransactionId: paymentIntent.id,
          paymentMethodId: paymentMethod.id,
          customerId: customer.id
        },
        paymentMethod: {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding
        }
      };

    } catch (error) {
      logger.error('Stripe payment processing failed:', error);
      
      return {
        success: false,
        error: error.message,
        code: error.code || 'STRIPE_ERROR',
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
      const refundData = {
        payment_intent: transactionId
      };

      if (amount) {
        refundData.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundData);

      logger.info(`Stripe refund processed: ${refund.id}`);

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency.toUpperCase(),
        gatewayResponse: {
          responseCode: '00',
          responseMessage: 'Refund successful',
          gatewayRefundId: refund.id
        }
      };

    } catch (error) {
      logger.error('Stripe refund processing failed:', error);
      
      return {
        success: false,
        error: error.message,
        code: error.code || 'STRIPE_REFUND_ERROR',
        gatewayResponse: {
          responseCode: '01',
          responseMessage: error.message,
          gatewayRefundId: null
        }
      };
    }
  }

  /**
   * Create payout
   */
  async createPayout(amount, currency, destination) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const payout = await this.stripe.payouts.create({
        amount: amount,
        currency: currency.toLowerCase(),
        destination: destination
      });

      logger.info(`Stripe payout created: ${payout.id}`);

      return {
        success: true,
        payoutId: payout.id,
        status: payout.status,
        amount: payout.amount,
        currency: payout.currency.toUpperCase(),
        arrivalDate: payout.arrival_date,
        gatewayResponse: {
          responseCode: '00',
          responseMessage: 'Payout created successfully',
          gatewayPayoutId: payout.id
        }
      };

    } catch (error) {
      logger.error('Stripe payout creation failed:', error);
      
      return {
        success: false,
        error: error.message,
        code: error.code || 'STRIPE_PAYOUT_ERROR',
        gatewayResponse: {
          responseCode: '01',
          responseMessage: error.message,
          gatewayPayoutId: null
        }
      };
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(body, signature) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.webhookSecret
      );

      logger.info(`Stripe webhook received: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        case 'charge.dispute.created':
          await this.handleDispute(event.data.object);
          break;
        case 'payout.paid':
          await this.handlePayoutPaid(event.data.object);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event.type}`);
      }

      return { success: true };

    } catch (error) {
      logger.error('Stripe webhook processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Map Stripe status to internal status
   */
  mapStripeStatus(stripeStatus) {
    const statusMap = {
      'succeeded': 'completed',
      'processing': 'processing',
      'requires_payment_method': 'failed',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'canceled': 'cancelled'
    };

    return statusMap[stripeStatus] || 'unknown';
  }

  /**
   * Handle payment success webhook
   */
  async handlePaymentSuccess(paymentIntent) {
    // Update transaction status in database
    logger.info(`Payment succeeded: ${paymentIntent.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Handle payment failure webhook
   */
  async handlePaymentFailure(paymentIntent) {
    // Update transaction status in database
    logger.info(`Payment failed: ${paymentIntent.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Handle dispute webhook
   */
  async handleDispute(dispute) {
    // Handle dispute in database
    logger.info(`Dispute created: ${dispute.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Handle payout paid webhook
   */
  async handlePayoutPaid(payout) {
    // Update payout status in database
    logger.info(`Payout paid: ${payout.id}`);
    // Implementation depends on your database structure
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentIntentId) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        success: true,
        data: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          created: paymentIntent.created,
          description: paymentIntent.description,
          customer: paymentIntent.customer,
          paymentMethod: paymentIntent.payment_method
        }
      };

    } catch (error) {
      logger.error('Failed to get payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List transactions
   */
  async listTransactions(limit = 10, startingAfter = null) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      const params = { limit };
      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const paymentIntents = await this.stripe.paymentIntents.list(params);
      
      return {
        success: true,
        data: paymentIntents.data.map(pi => ({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          created: pi.created,
          description: pi.description,
          customer: pi.customer
        })),
        hasMore: paymentIntents.has_more
      };

    } catch (error) {
      logger.error('Failed to list transactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = StripeService;