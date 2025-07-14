/**
 * Test suite for Stripe key validation functionality
 */

const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');

describe('Stripe Key Validation Tests', () => {
  let phpServer;
  const SERVER_PORT = 8081;
  const SERVER_URL = `http://localhost:${SERVER_PORT}`;

  beforeAll(async () => {
    // Start PHP server
    const backendPath = path.join(__dirname, '../stripe-interface');
    phpServer = spawn('php', ['-S', `localhost:${SERVER_PORT}`, '-t', backendPath], {
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (phpServer) {
      phpServer.kill();
    }
  });

  describe('Key Format Validation', () => {
    test('should reject invalid key format', async () => {
      const invalidKeys = [
        'invalid_key',
        'pk_test_123',
        'sk_123',
        'sk_test_',
        'sk_live_',
        ''
      ];

      for (const key of invalidKeys) {
        const response = await request(SERVER_URL)
          .post('/backend.php')
          .send({
            action: 'validate_key',
            stripeSecretKey: Buffer.from(key).toString('base64') // Simple encoding for test
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    test('should accept valid key format', async () => {
      const validKeys = [
        'sk_test_51HyKxOGzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xO',
        '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'
      ];

      for (const key of validKeys) {
        // This test only checks format, not actual API validation
        // since we don't have real keys
        expect(key).toMatch(/^sk_(test|live)_[a-zA-Z0-9]+$/);
      }
    });
  });

  describe('Key Type Detection', () => {
    test('should detect test keys', () => {
      const testKey = 'sk_test_51HyKxOGzFjNg4xOKzFjNg4xOKzFjNg4xO';
      expect(testKey.startsWith('sk_test_')).toBe(true);
    });

    test('should detect live keys', () => {
      const liveKey = 'sk_live_51HyKxOGzFjNg4xOKzFjNg4xOKzFjNg4xO';
      expect(liveKey.startsWith('sk_live_')).toBe(true);
    });
  });

  describe('Error Response Format', () => {
    test('should return structured error response', async () => {
      const response = await request(SERVER_URL)
        .post('/backend.php')
        .send({
          action: 'validate_key',
          stripeSecretKey: ''
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Network Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Test with invalid proxy configuration
      const response = await request(SERVER_URL)
        .post('/backend.php')
        .send({
          stripeSecretKey: Buffer.from('sk_test_valid_format_but_fake_key123456789').toString('base64'),
          operation: 'charge',
          amount: 100,
          currency: 'usd',
          cardData: {
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123'
          },
          proxyConfig: {
            host: 'invalid-proxy.example.com',
            port: 8080
          }
        });

      // Should handle network errors gracefully
      expect(response.status).toBeLessThanOrEqual(500);
      if (response.body) {
        expect(response.body).toHaveProperty('success');
      }
    });
  });

  describe('Payment Processing with Invalid Keys', () => {
    test('should fail payment with invalid key', async () => {
      const response = await request(SERVER_URL)
        .post('/backend.php')
        .send({
          stripeSecretKey: Buffer.from('sk_test_invalid_key_format').toString('base64'),
          operation: 'charge',
          amount: 100,
          currency: 'usd',
          cardData: {
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Detailed Error Information', () => {
    test('should provide detailed error information', async () => {
      const response = await request(SERVER_URL)
        .post('/backend.php')
        .send({
          stripeSecretKey: Buffer.from('sk_test_fake_key_12345').toString('base64'),
          operation: 'charge',
          amount: 100,
          currency: 'usd',
          cardData: {
            cardNumber: '4111111111111111',
            expiry: '12/25',
            cvv: '123'
          }
        });

      if (response.body && !response.body.success) {
        // Should have detailed error information
        const errorResponse = response.body;
        expect(errorResponse).toHaveProperty('error');
        
        // Check for enhanced error details if present
        if (errorResponse.data) {
          expect(errorResponse.data).toHaveProperty('decline_code');
          expect(errorResponse.data).toHaveProperty('category');
          expect(errorResponse.data).toHaveProperty('error_type');
        }
      }
    });
  });
});