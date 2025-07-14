const { 
  toCents, 
  fromCents, 
  formatAmount, 
  validateAmount, 
  validateEmail, 
  validatePhone, 
  calculateRiskScore 
} = require('../src/utils/helpers');

describe('Helper Utils', () => {
  describe('toCents/fromCents', () => {
    test('should convert dollars to cents correctly', () => {
      expect(toCents(1.00)).toBe(100);
      expect(toCents(10.50)).toBe(1050);
      expect(toCents(0.01)).toBe(1);
      expect(toCents(999.99)).toBe(99999);
    });

    test('should convert cents to dollars correctly', () => {
      expect(fromCents(100)).toBe(1.00);
      expect(fromCents(1050)).toBe(10.50);
      expect(fromCents(1)).toBe(0.01);
      expect(fromCents(99999)).toBe(999.99);
    });

    test('should handle edge cases', () => {
      expect(toCents(0)).toBe(0);
      expect(fromCents(0)).toBe(0);
      expect(toCents(null)).toBe(0);
      expect(fromCents(null)).toBe(0);
    });
  });

  describe('formatAmount', () => {
    test('should format amounts correctly', () => {
      expect(formatAmount(100, 'USD')).toBe('$1.00');
      expect(formatAmount(1050, 'USD')).toBe('$10.50');
      expect(formatAmount(1, 'USD')).toBe('$0.01');
      expect(formatAmount(99999, 'USD')).toBe('$999.99');
    });

    test('should handle different currencies', () => {
      expect(formatAmount(100, 'EUR')).toBe('€1.00');
      expect(formatAmount(100, 'GBP')).toBe('£1.00');
      expect(formatAmount(100, 'CAD')).toBe('C$1.00');
    });
  });

  describe('validateAmount', () => {
    test('should validate valid amounts', () => {
      expect(validateAmount(100).isValid).toBe(true); // $1.00
      expect(validateAmount(1).isValid).toBe(true); // $0.01
      expect(validateAmount(99999999).isValid).toBe(true); // $999,999.99
    });

    test('should reject invalid amounts', () => {
      expect(validateAmount(0).isValid).toBe(false); // $0.00
      expect(validateAmount(-1).isValid).toBe(false); // Negative
      expect(validateAmount(100000000).isValid).toBe(false); // Too large
      expect(validateAmount(1.5).isValid).toBe(false); // Not whole cents
      expect(validateAmount(null).isValid).toBe(false); // Null
    });
  });

  describe('validateEmail', () => {
    test('should validate valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('first.last@subdomain.domain.com')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    test('should validate valid phone numbers', () => {
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('1234567890')).toBe(true);
      expect(validatePhone('+441234567890')).toBe(true);
      expect(validatePhone('12345678901')).toBe(true);
    });

    test('should reject invalid phone numbers', () => {
      expect(validatePhone('123')).toBe(false); // Too short
      expect(validatePhone('123456789')).toBe(false); // Too short
      expect(validatePhone('abc123456789')).toBe(false); // Contains letters
      expect(validatePhone('')).toBe(false); // Empty
      expect(validatePhone(null)).toBe(false); // Null
    });
  });

  describe('calculateRiskScore', () => {
    test('should calculate risk scores correctly', () => {
      const lowRiskTransaction = {
        amount: 5000, // $50
        cvvProvided: true,
        cardType: 'visa',
        customerHistory: {
          totalTransactions: 10,
          successfulTransactions: 10,
          failedTransactions: 0
        }
      };

      const result = calculateRiskScore(lowRiskTransaction);
      expect(result.level).toBe('low');
      expect(result.score).toBeLessThan(30);
    });

    test('should identify high risk transactions', () => {
      const highRiskTransaction = {
        amount: 100000, // $1000
        cvvProvided: false,
        cardType: 'unknown',
        customerHistory: {
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0
        }
      };

      const result = calculateRiskScore(highRiskTransaction);
      expect(result.level).toBe('very_high');
      expect(result.score).toBeGreaterThan(70);
    });
  });
});