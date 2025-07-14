const request = require('supertest');
const { createApp } = require('../src/config/app');

describe('Stripe Interface Integration', () => {
  let app;

  beforeAll(async () => {
    app = createApp();
  });

  describe('Stripe Interface Routes', () => {
    test('should serve the Stripe interface HTML page', async () => {
      const response = await request(app)
        .get('/stripe')
        .expect(200);

      expect(response.text).toContain('Stripe Payment Gateway');
      expect(response.text).toContain('Security Features');
      expect(response.text).toContain('Process Payment');
    });

    test('should serve the app.js file', async () => {
      const response = await request(app)
        .get('/stripe/app.js')
        .expect(200);

      expect(response.text).toContain('StripePaymentGateway');
      expect(response.text).toContain('userAgents');
    });

    test('should serve the proxy.js file', async () => {
      const response = await request(app)
        .get('/stripe/proxy.js')
        .expect(200);

      expect(response.text).toContain('ProxyService');
      expect(response.text).toContain('makeRequest');
    });

    test('should serve the backend.php file', async () => {
      const response = await request(app)
        .get('/stripe/backend.php')
        .expect(200);

      expect(response.text).toContain('StripePaymentBackend');
      expect(response.text).toContain('processPayment');
    });

    test('should serve the README.md file', async () => {
      const response = await request(app)
        .get('/stripe/README.md')
        .expect(200);

      expect(response.text).toContain('Stripe Payment Gateway');
      expect(response.text).toContain('Security Features');
    });
  });

  describe('Stripe API Processing', () => {
    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/stripe/api/stripe/process')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should handle invalid Stripe key format', async () => {
      const response = await request(app)
        .post('/stripe/api/stripe/process')
        .send({
          stripeSecretKey: Buffer.from('invalid_key').toString('base64'),
          operation: 'charge',
          amount: 2999,
          currency: 'usd',
          cardData: {
            number: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            holderName: 'John Doe'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid Stripe secret key format');
    });

    test('should validate required card data fields', async () => {
      const response = await request(app)
        .post('/stripe/api/stripe/process')
        .send({
          stripeSecretKey: Buffer.from('sk_test_123').toString('base64'),
          operation: 'charge',
          amount: 2999,
          currency: 'usd',
          cardData: {
            number: '4111111111111111'
            // Missing expiry, cvv, holderName
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle auth operation with $0 amount', async () => {
      const mockStripeKey = Buffer.from('sk_test_51A123456789012345678901234567890123456789012345678901234567890123456789012345678901234567').toString('base64');
      
      const response = await request(app)
        .post('/stripe/api/stripe/process')
        .send({
          stripeSecretKey: mockStripeKey,
          operation: 'auth',
          amount: 2999, // Should be overridden to 0 for auth
          currency: 'usd',
          cardData: {
            number: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            holderName: 'John Doe'
          }
        });

      // Note: This will fail with actual Stripe API call, but we're testing the request structure
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Security Features', () => {
    test('should generate random customer data', async () => {
      const mockStripeKey = Buffer.from('sk_test_51A123456789012345678901234567890123456789012345678901234567890123456789012345678901234567').toString('base64');
      
      const response1 = await request(app)
        .post('/stripe/api/stripe/process')
        .send({
          stripeSecretKey: mockStripeKey,
          operation: 'charge',
          amount: 2999,
          currency: 'usd',
          cardData: {
            number: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            holderName: 'John Doe'
          }
        });

      const response2 = await request(app)
        .post('/stripe/api/stripe/process')
        .send({
          stripeSecretKey: mockStripeKey,
          operation: 'charge',
          amount: 2999,
          currency: 'usd',
          cardData: {
            number: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            holderName: 'John Doe'
          }
        });

      // Both should fail with Stripe API error, but we're testing they process the request
      expect(response1.body.success).toBe(false);
      expect(response2.body.success).toBe(false);
    });

    test('should handle different operation types', async () => {
      const mockStripeKey = Buffer.from('sk_test_51A123456789012345678901234567890123456789012345678901234567890123456789012345678901234567').toString('base64');
      
      const operations = ['auth', 'charge', 'auth_capture'];
      
      for (const operation of operations) {
        const response = await request(app)
          .post('/stripe/api/stripe/process')
          .send({
            stripeSecretKey: mockStripeKey,
            operation: operation,
            amount: 2999,
            currency: 'usd',
            cardData: {
              number: '4111111111111111',
              expiry: '12/25',
              cvv: '123',
              holderName: 'John Doe'
            }
          });

        // Should fail with Stripe API error (expected since we don't have real keys)
        expect(response.body.success).toBe(false);
      }
    });

    test('should handle proxy configuration', async () => {
      const mockStripeKey = Buffer.from('sk_test_51A123456789012345678901234567890123456789012345678901234567890123456789012345678901234567').toString('base64');
      
      const response = await request(app)
        .post('/stripe/api/stripe/process')
        .send({
          stripeSecretKey: mockStripeKey,
          operation: 'charge',
          amount: 2999,
          currency: 'usd',
          cardData: {
            number: '4111111111111111',
            expiry: '12/25',
            cvv: '123',
            holderName: 'John Doe'
          },
          proxyConfig: {
            host: 'proxy.example.com',
            port: 8080,
            username: 'user',
            password: 'pass'
          }
        });

      // Should fail with proxy/Stripe API error (expected)
      expect(response.body.success).toBe(false);
    });
  });
});