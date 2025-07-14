const { CARD_TYPES, CARD_PATTERNS, CVV_LENGTHS } = require('../config/constants');
const { logger } = require('./logger');

/**
 * Validate credit card number using Luhn algorithm
 * @param {string} cardNumber - Card number to validate
 * @returns {boolean} - True if valid
 */
const validateCardNumber = (cardNumber) => {
  try {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return false;
    }

    // Remove all non-digit characters
    const cleanNumber = cardNumber.replace(/\D/g, '');

    // Check if it's a valid length
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEvenPosition = false;

    // Process digits from right to left
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i]);

      if (isEvenPosition) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEvenPosition = !isEvenPosition;
    }

    const isValid = sum % 10 === 0;
    logger.info(`Card number validation: ${isValid ? 'valid' : 'invalid'}`);
    return isValid;
  } catch (error) {
    logger.error('Card number validation failed:', error);
    return false;
  }
};

/**
 * Detect card type based on card number
 * @param {string} cardNumber - Card number
 * @returns {string} - Card type
 */
const detectCardType = (cardNumber) => {
  try {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return CARD_TYPES.UNKNOWN;
    }

    const cleanNumber = cardNumber.replace(/\D/g, '');

    // Check patterns in order of specificity
    if (CARD_PATTERNS.AMEX.test(cleanNumber)) {
      return CARD_TYPES.AMEX;
    }
    if (CARD_PATTERNS.VISA.test(cleanNumber)) {
      return CARD_TYPES.VISA;
    }
    if (CARD_PATTERNS.MASTERCARD.test(cleanNumber)) {
      return CARD_TYPES.MASTERCARD;
    }
    if (CARD_PATTERNS.DISCOVER.test(cleanNumber)) {
      return CARD_TYPES.DISCOVER;
    }

    logger.warn(`Unknown card type for number: ${cardNumber.substring(0, 4)}****`);
    return CARD_TYPES.UNKNOWN;
  } catch (error) {
    logger.error('Card type detection failed:', error);
    return CARD_TYPES.UNKNOWN;
  }
};

/**
 * Validate CVV based on card type
 * @param {string} cvv - CVV to validate
 * @param {string} cardType - Card type
 * @returns {boolean} - True if valid
 */
const validateCvv = (cvv, cardType) => {
  try {
    if (!cvv || typeof cvv !== 'string') {
      return false;
    }

    const cleanCvv = cvv.replace(/\D/g, '');
    const expectedLength = CVV_LENGTHS[cardType.toUpperCase()] || 3;

    const isValid = cleanCvv.length === expectedLength;
    logger.info(`CVV validation for ${cardType}: ${isValid ? 'valid' : 'invalid'}`);
    return isValid;
  } catch (error) {
    logger.error('CVV validation failed:', error);
    return false;
  }
};

/**
 * Validate expiry date
 * @param {string} expiryDate - Expiry date in MM/YY or MM/YYYY format
 * @returns {boolean} - True if valid and not expired
 */
const validateExpiryDate = (expiryDate) => {
  try {
    if (!expiryDate || typeof expiryDate !== 'string') {
      return false;
    }

    // Parse MM/YY or MM/YYYY format
    const parts = expiryDate.split('/');
    if (parts.length !== 2) {
      return false;
    }

    const month = parseInt(parts[0], 10);
    let year = parseInt(parts[1], 10);

    // Convert YY to YYYY
    if (year < 100) {
      year += 2000;
    }

    // Validate month
    if (month < 1 || month > 12) {
      return false;
    }

    // Create expiry date (last day of the month)
    const expiryDateObj = new Date(year, month, 0);
    const currentDate = new Date();

    // Set current date to first day of current month for comparison
    currentDate.setDate(1);
    currentDate.setHours(0, 0, 0, 0);

    const isValid = expiryDateObj >= currentDate;
    logger.info(`Expiry date validation: ${isValid ? 'valid' : 'expired'}`);
    return isValid;
  } catch (error) {
    logger.error('Expiry date validation failed:', error);
    return false;
  }
};

/**
 * Get card brand name for display
 * @param {string} cardType - Card type
 * @returns {string} - Brand name
 */
const getCardBrandName = (cardType) => {
  const brandNames = {
    [CARD_TYPES.VISA]: 'Visa',
    [CARD_TYPES.MASTERCARD]: 'Mastercard',
    [CARD_TYPES.AMEX]: 'American Express',
    [CARD_TYPES.DISCOVER]: 'Discover',
    [CARD_TYPES.UNKNOWN]: 'Unknown'
  };

  return brandNames[cardType] || 'Unknown';
};

/**
 * Get last 4 digits of card number
 * @param {string} cardNumber - Card number
 * @returns {string} - Last 4 digits
 */
const getCardLast4 = (cardNumber) => {
  try {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return '****';
    }

    const cleanNumber = cardNumber.replace(/\D/g, '');
    return cleanNumber.slice(-4);
  } catch (error) {
    logger.error('Error getting card last 4 digits:', error);
    return '****';
  }
};

/**
 * Format card number for display (with spaces)
 * @param {string} cardNumber - Card number
 * @returns {string} - Formatted card number
 */
const formatCardNumber = (cardNumber) => {
  try {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return '';
    }

    const cleanNumber = cardNumber.replace(/\D/g, '');
    const cardType = detectCardType(cleanNumber);

    // Different formatting for different card types
    if (cardType === CARD_TYPES.AMEX) {
      // AMEX: 4-6-5 format
      return cleanNumber.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
    } else {
      // Others: 4-4-4-4 format
      return cleanNumber.replace(/(\d{4})/g, '$1 ').trim();
    }
  } catch (error) {
    logger.error('Card number formatting failed:', error);
    return cardNumber;
  }
};

/**
 * Validate complete card data
 * @param {object} cardData - Card data to validate
 * @returns {object} - Validation result
 */
const validateCardData = (cardData) => {
  try {
    const {
      cardNumber,
      expiryDate,
      cvv,
      cardholderName
    } = cardData;

    const result = {
      isValid: true,
      errors: [],
      cardType: CARD_TYPES.UNKNOWN,
      cardLast4: '****',
      cardBrand: 'Unknown'
    };

    // Validate card number
    if (!validateCardNumber(cardNumber)) {
      result.isValid = false;
      result.errors.push('Invalid card number');
    } else {
      result.cardType = detectCardType(cardNumber);
      result.cardLast4 = getCardLast4(cardNumber);
      result.cardBrand = getCardBrandName(result.cardType);
    }

    // Validate expiry date
    if (!validateExpiryDate(expiryDate)) {
      result.isValid = false;
      result.errors.push('Invalid or expired card');
    }

    // Validate CVV if provided
    if (cvv && !validateCvv(cvv, result.cardType)) {
      result.isValid = false;
      result.errors.push('Invalid CVV');
    }

    // Validate cardholder name
    if (!cardholderName || cardholderName.trim().length < 2) {
      result.isValid = false;
      result.errors.push('Cardholder name is required');
    }

    logger.info(`Card validation result: ${result.isValid ? 'valid' : 'invalid'}`);
    return result;
  } catch (error) {
    logger.error('Card data validation failed:', error);
    return {
      isValid: false,
      errors: ['Card validation failed'],
      cardType: CARD_TYPES.UNKNOWN,
      cardLast4: '****',
      cardBrand: 'Unknown'
    };
  }
};

/**
 * Check if card number is a test card
 * @param {string} cardNumber - Card number
 * @returns {boolean} - True if test card
 */
const isTestCard = (cardNumber) => {
  try {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return false;
    }

    const cleanNumber = cardNumber.replace(/\D/g, '');
    const { TEST_CARDS } = require('../config/constants');
    
    return Object.values(TEST_CARDS).includes(cleanNumber);
  } catch (error) {
    logger.error('Test card check failed:', error);
    return false;
  }
};

/**
 * Get BIN (Bank Identification Number) from card
 * @param {string} cardNumber - Card number
 * @returns {string} - BIN (first 6 digits)
 */
const getBin = (cardNumber) => {
  try {
    if (!cardNumber || typeof cardNumber !== 'string') {
      return '';
    }

    const cleanNumber = cardNumber.replace(/\D/g, '');
    return cleanNumber.substring(0, 6);
  } catch (error) {
    logger.error('BIN extraction failed:', error);
    return '';
  }
};

module.exports = {
  validateCardNumber,
  detectCardType,
  validateCvv,
  validateExpiryDate,
  getCardBrandName,
  getCardLast4,
  formatCardNumber,
  validateCardData,
  isTestCard,
  getBin
};