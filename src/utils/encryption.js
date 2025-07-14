const crypto = require('crypto');
const { logger } = require('./logger');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-character-key-for-dev';
const ALGORITHM = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Ensure encryption key is the correct length
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
}

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text with IV and tag
 */
const encrypt = (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input for encryption');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('boom-payment-gateway', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    const result = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    
    logger.info('Data encrypted successfully');
    return result;
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text with IV and tag
 * @returns {string} - Decrypted text
 */
const decrypt = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Invalid input for decryption');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('boom-payment-gateway', 'utf8'));
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    logger.info('Data decrypted successfully');
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Decryption failed');
  }
};

/**
 * Generate a secure random token
 * @param {number} length - Token length
 * @returns {string} - Random token
 */
const generateToken = (length = 32) => {
  try {
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    logger.error('Token generation failed:', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Hash a password with salt
 * @param {string} password - Password to hash
 * @returns {string} - Hashed password
 */
const hashPassword = (password) => {
  try {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  } catch (error) {
    logger.error('Password hashing failed:', error);
    throw new Error('Password hashing failed');
  }
};

/**
 * Verify a password against a hash
 * @param {string} password - Password to verify
 * @param {string} hashedPassword - Stored hash
 * @returns {boolean} - True if password matches
 */
const verifyPassword = (password, hashedPassword) => {
  try {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch (error) {
    logger.error('Password verification failed:', error);
    return false;
  }
};

/**
 * Generate a secure card token
 * @param {string} cardNumber - Card number to tokenize
 * @param {string} expiryDate - Card expiry date
 * @returns {string} - Secure token
 */
const generateCardToken = (cardNumber, expiryDate) => {
  try {
    const tokenData = {
      cardNumber,
      expiryDate,
      timestamp: Date.now(),
      random: crypto.randomBytes(16).toString('hex')
    };
    
    const tokenString = JSON.stringify(tokenData);
    const encryptedToken = encrypt(tokenString);
    
    // Create a shorter, database-friendly token
    const shortToken = crypto.createHash('sha256')
      .update(encryptedToken)
      .digest('hex')
      .substring(0, 32);
    
    return {
      token: shortToken,
      encryptedData: encryptedToken
    };
  } catch (error) {
    logger.error('Card token generation failed:', error);
    throw new Error('Card token generation failed');
  }
};

/**
 * Decrypt a card token
 * @param {string} encryptedData - Encrypted token data
 * @returns {object} - Card data
 */
const decryptCardToken = (encryptedData) => {
  try {
    const decryptedString = decrypt(encryptedData);
    const tokenData = JSON.parse(decryptedString);
    
    // Verify token age (expire after 24 hours)
    const tokenAge = Date.now() - tokenData.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      throw new Error('Token expired');
    }
    
    return {
      cardNumber: tokenData.cardNumber,
      expiryDate: tokenData.expiryDate
    };
  } catch (error) {
    logger.error('Card token decryption failed:', error);
    throw new Error('Invalid or expired token');
  }
};

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of characters to show at start/end
 * @returns {string} - Masked data
 */
const maskSensitiveData = (data, visibleChars = 4) => {
  if (!data || typeof data !== 'string') {
    return '[INVALID]';
  }
  
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const middle = '*'.repeat(data.length - (visibleChars * 2));
  
  return `${start}${middle}${end}`;
};

/**
 * Generate HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {string} - HMAC signature
 */
const generateHmacSignature = (data, secret) => {
  try {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  } catch (error) {
    logger.error('HMAC generation failed:', error);
    throw new Error('HMAC generation failed');
  }
};

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key
 * @returns {boolean} - True if signature is valid
 */
const verifyHmacSignature = (data, signature, secret) => {
  try {
    const expectedSignature = generateHmacSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('HMAC verification failed:', error);
    return false;
  }
};

module.exports = {
  encrypt,
  decrypt,
  generateToken,
  hashPassword,
  verifyPassword,
  generateCardToken,
  decryptCardToken,
  maskSensitiveData,
  generateHmacSignature,
  verifyHmacSignature
};