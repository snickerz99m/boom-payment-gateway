const { validateCardData, detectCardType, validateCvv, validateExpiryDate } = require('./src/utils/cardValidator');

// Test the card validation
const cardData = {
  cardNumber: "4111111111111111",
  expiryDate: "12/25",
  cvv: "123",
  cardholderName: "John Doe"
};

console.log('Testing card validation:');
console.log('Card number:', cardData.cardNumber);
console.log('Expiry date:', cardData.expiryDate);
console.log('CVV:', cardData.cvv);
console.log('');

// Test individual validators
console.log('Individual validators:');
console.log('validateExpiryDate:', validateExpiryDate(cardData.expiryDate));
console.log('detectCardType:', detectCardType(cardData.cardNumber));
console.log('validateCvv:', validateCvv(cardData.cvv, detectCardType(cardData.cardNumber)));
console.log('');

// Test full validation
console.log('Full validation:');
const result = validateCardData(cardData);
console.log('Result:', result);