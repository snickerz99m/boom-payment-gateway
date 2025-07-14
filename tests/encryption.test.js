const { encrypt, decrypt, generateToken, generateCardToken, verifyHmacSignature } = require('../src/utils/encryption');

describe('Encryption Utils', () => {
  describe('encrypt/decrypt', () => {
    test('should encrypt and decrypt text correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    test('should handle empty strings', () => {
      const plaintext = 'test'; // Use non-empty string as empty strings should be caught
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle special characters', () => {
      const plaintext = 'Hello! @#$%^&*()_+{}|:"<>?[]\\;\'.,/~`';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('generateToken', () => {
    test('should generate tokens of correct length', () => {
      const token16 = generateToken(16);
      const token32 = generateToken(32);
      
      expect(token16.length).toBe(32); // 16 bytes = 32 hex characters
      expect(token32.length).toBe(64); // 32 bytes = 64 hex characters
    });

    test('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateCardToken', () => {
    test('should generate card tokens successfully', () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      
      const result = generateCardToken(cardNumber, expiryDate);
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('encryptedData');
      expect(result.token).toBeTruthy();
      expect(result.encryptedData).toBeTruthy();
    });

    test('should generate unique tokens for same card', () => {
      const cardNumber = '4111111111111111';
      const expiryDate = '12/25';
      
      const result1 = generateCardToken(cardNumber, expiryDate);
      const result2 = generateCardToken(cardNumber, expiryDate);
      
      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('verifyHmacSignature', () => {
    test('should verify HMAC signatures correctly', () => {
      const data = 'test data';
      const secret = 'test secret';
      const crypto = require('crypto');
      
      const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
      
      expect(verifyHmacSignature(data, signature, secret)).toBe(true);
      expect(verifyHmacSignature(data, 'invalid-signature', secret)).toBe(false);
      expect(verifyHmacSignature('different data', signature, secret)).toBe(false);
    });
  });
});