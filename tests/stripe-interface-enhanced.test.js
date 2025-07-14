const fs = require('fs');
const path = require('path');

describe('Enhanced Stripe Interface Tests', () => {
  let htmlContent;
  let jsContent;
  let phpContent;
  
  beforeAll(() => {
    // Read the interface files
    const interfacePath = path.join(__dirname, '../stripe-interface');
    htmlContent = fs.readFileSync(path.join(interfacePath, 'index.html'), 'utf8');
    jsContent = fs.readFileSync(path.join(interfacePath, 'app.js'), 'utf8');
    phpContent = fs.readFileSync(path.join(interfacePath, 'backend.php'), 'utf8');
  });
  
  describe('HTML Interface Structure', () => {
    test('should contain bulk cards textarea', () => {
      expect(htmlContent).toContain('id="bulkCards"');
      expect(htmlContent).toContain('cardnum|mm|yy|cvv');
      expect(htmlContent).toContain('cardnum|mm|yyyy|cvv');
    });
    
    test('should contain separate result boxes', () => {
      expect(htmlContent).toContain('id="authorizedCards"');
      expect(htmlContent).toContain('id="chargedCards"');
      expect(htmlContent).toContain('id="declinedCards"');
      expect(htmlContent).toContain('id="cvvIssues"');
      expect(htmlContent).toContain('id="validCards"');
      expect(htmlContent).toContain('id="processingLog"');
    });
    
    test('should contain copy buttons for result boxes', () => {
      expect(htmlContent).toContain('copy-btn');
      expect(htmlContent).toContain('copyResultBox');
    });
    
    test('should contain key validation elements', () => {
      expect(htmlContent).toContain('id="keyValidation"');
      expect(htmlContent).toContain('sk_live_... or sk_test_...');
    });
    
    test('should contain enhanced features description', () => {
      expect(htmlContent).toContain('Bulk card processing with detailed status reporting');
      expect(htmlContent).toContain('Real-time Stripe key validation');
      expect(htmlContent).toContain('Automatic email and name generation');
      expect(htmlContent).toContain('Separate result boxes for different card statuses');
      expect(htmlContent).toContain('Copy functionality for easy result management');
    });
  });
  
  describe('JavaScript Enhanced Functionality', () => {
    test('should contain StripePaymentGateway class', () => {
      expect(jsContent).toContain('class StripePaymentGateway');
    });
    
    test('should contain bulk card processing functions', () => {
      expect(jsContent).toContain('processBulkCards');
      expect(jsContent).toContain('validateBulkCards');
      expect(jsContent).toContain('handleBulkCardsInput');
    });
    
    test('should contain result categorization functions', () => {
      expect(jsContent).toContain('categorizeResult');
      expect(jsContent).toContain('updateResultBoxes');
      expect(jsContent).toContain('formatResults');
    });
    
    test('should contain enhanced customer data generation', () => {
      expect(jsContent).toContain('generateCustomerData');
      expect(jsContent).toContain('generateRandomName');
      expect(jsContent).toContain('generateRandomEmail');
    });
    
    test('should contain Stripe key validation', () => {
      expect(jsContent).toContain('validateStripeKeyFormat');
      expect(jsContent).toContain('setupKeyValidation');
    });
    
    test('should contain enhanced user agents and data', () => {
      expect(jsContent).toContain('protonmail.com');
      expect(jsContent).toContain('tutanota.com');
      expect(jsContent).toContain('Steven');
      expect(jsContent).toContain('Mitchell');
    });
  });
  
  describe('Backend PHP Enhanced Features', () => {
    test('should contain StripePaymentBackend class', () => {
      expect(phpContent).toContain('class StripePaymentBackend');
    });
    
    test('should contain decline reason handling', () => {
      expect(phpContent).toContain('declineReasons');
      expect(phpContent).toContain('categorizeError');
      expect(phpContent).toContain('handlePaymentError');
    });
    
    test('should contain enhanced customer data generation', () => {
      expect(phpContent).toContain('generateEnhancedCustomerData');
      expect(phpContent).toContain('protonmail.com');
      expect(phpContent).toContain('tutanota.com');
    });
    
    test('should contain Stripe key validation', () => {
      expect(phpContent).toContain('validateStripeKeyAlive');
      expect(phpContent).toContain('isValidStripeKey');
    });
    
    test('should contain different operation handlers', () => {
      expect(phpContent).toContain('handleAuthorizationResponse');
      expect(phpContent).toContain('handleChargeResponse');
      expect(phpContent).toContain('handleAuthCaptureResponse');
    });
    
    test('should contain enhanced error categorization', () => {
      expect(phpContent).toContain('cvv_issue');
      expect(phpContent).toContain('expired');
      expect(phpContent).toContain('stolen');
      expect(phpContent).toContain('declined');
    });
  });
  
  describe('Configuration and Setup', () => {
    test('should have proper file permissions expectations', () => {
      const interfacePath = path.join(__dirname, '../stripe-interface');
      expect(fs.existsSync(path.join(interfacePath, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(interfacePath, 'app.js'))).toBe(true);
      expect(fs.existsSync(path.join(interfacePath, 'backend.php'))).toBe(true);
    });
    
    test('should contain security headers and features', () => {
      expect(phpContent).toContain('X-Content-Type-Options');
      expect(phpContent).toContain('X-Frame-Options');
      expect(phpContent).toContain('setSecurityHeaders');
      expect(phpContent).toContain('checkRateLimit');
    });
  });
});