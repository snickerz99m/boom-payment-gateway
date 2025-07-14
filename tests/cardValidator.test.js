const { validateCardNumber, detectCardType, validateCvv, validateExpiryDate } = require('../src/utils/cardValidator');

describe('Card Validator', () => {
  describe('validateCardNumber', () => {
    test('should validate valid card numbers', () => {
      expect(validateCardNumber('4111111111111111')).toBe(true); // Visa
      expect(validateCardNumber('5555555555554444')).toBe(true); // Mastercard
      expect(validateCardNumber('378282246310005')).toBe(true); // Amex
      expect(validateCardNumber('6011111111111117')).toBe(true); // Discover
    });

    test('should reject invalid card numbers', () => {
      expect(validateCardNumber('4111111111111112')).toBe(false); // Wrong checksum
      expect(validateCardNumber('1234567890123456')).toBe(false); // Invalid number
      expect(validateCardNumber('411111111111111')).toBe(false); // Too short
      expect(validateCardNumber('41111111111111111')).toBe(false); // Too long
      expect(validateCardNumber('')).toBe(false); // Empty
      expect(validateCardNumber(null)).toBe(false); // Null
    });
  });

  describe('detectCardType', () => {
    test('should detect card types correctly', () => {
      expect(detectCardType('4111111111111111')).toBe('visa');
      expect(detectCardType('5555555555554444')).toBe('mastercard');
      expect(detectCardType('378282246310005')).toBe('amex');
      expect(detectCardType('6011111111111117')).toBe('discover');
      expect(detectCardType('1234567890123456')).toBe('unknown');
    });
  });

  describe('validateCvv', () => {
    test('should validate CVV correctly', () => {
      expect(validateCvv('123', 'visa')).toBe(true);
      expect(validateCvv('123', 'mastercard')).toBe(true);
      expect(validateCvv('1234', 'amex')).toBe(true);
      expect(validateCvv('123', 'discover')).toBe(true);
    });

    test('should reject invalid CVV', () => {
      expect(validateCvv('12', 'visa')).toBe(false); // Too short
      expect(validateCvv('1234', 'visa')).toBe(false); // Too long for visa
      expect(validateCvv('123', 'amex')).toBe(false); // Too short for amex
      expect(validateCvv('abc', 'visa')).toBe(false); // Non-numeric
    });
  });

  describe('validateExpiryDate', () => {
    test('should validate valid expiry dates', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);
      const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
      const year = futureDate.getFullYear().toString().slice(-2);
      
      expect(validateExpiryDate(`${month}/${year}`)).toBe(true);
      expect(validateExpiryDate(`${month}/${futureDate.getFullYear()}`)).toBe(true);
    });

    test('should reject invalid expiry dates', () => {
      expect(validateExpiryDate('01/20')).toBe(false); // Past date
      expect(validateExpiryDate('13/25')).toBe(false); // Invalid month
      expect(validateExpiryDate('00/25')).toBe(false); // Invalid month
      expect(validateExpiryDate('01/2020')).toBe(false); // Past year
      expect(validateExpiryDate('invalid')).toBe(false); // Invalid format
    });
  });
});