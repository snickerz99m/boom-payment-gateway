const { sequelize } = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');
const { hashPassword, generateCardToken } = require('../../src/utils/encryption');
const { generateCustomerId } = require('../../src/utils/helpers');

// Import models
const Customer = require('../../src/models/Customer');
const PaymentMethod = require('../../src/models/PaymentMethod');
const Transaction = require('../../src/models/Transaction');
const Refund = require('../../src/models/Refund');

// Sample customer data
const sampleCustomers = [
  {
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'US',
    status: 'active',
    riskLevel: 'low'
  },
  {
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+1234567891',
    address: '456 Oak Ave',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90210',
    country: 'US',
    status: 'active',
    riskLevel: 'low'
  },
  {
    email: 'bob.wilson@example.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    phone: '+1234567892',
    address: '789 Pine St',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
    country: 'US',
    status: 'active',
    riskLevel: 'medium'
  },
  {
    email: 'alice.brown@example.com',
    firstName: 'Alice',
    lastName: 'Brown',
    phone: '+1234567893',
    address: '321 Elm St',
    city: 'Houston',
    state: 'TX',
    zipCode: '77001',
    country: 'US',
    status: 'active',
    riskLevel: 'low'
  },
  {
    email: 'charlie.davis@example.com',
    firstName: 'Charlie',
    lastName: 'Davis',
    phone: '+1234567894',
    address: '654 Maple Ave',
    city: 'Phoenix',
    state: 'AZ',
    zipCode: '85001',
    country: 'US',
    status: 'active',
    riskLevel: 'high'
  }
];

// Sample payment method data (test card numbers)
const samplePaymentMethods = [
  {
    cardNumber: '4111111111111111', // Visa test card
    expiryMonth: 12,
    expiryYear: 2025,
    cardholderName: 'John Doe',
    cardType: 'visa',
    cardBrand: 'Visa',
    billingAddress: '123 Main St',
    billingCity: 'New York',
    billingState: 'NY',
    billingZipCode: '10001',
    billingCountry: 'US',
    isDefault: true
  },
  {
    cardNumber: '5555555555554444', // Mastercard test card
    expiryMonth: 10,
    expiryYear: 2026,
    cardholderName: 'Jane Smith',
    cardType: 'mastercard',
    cardBrand: 'Mastercard',
    billingAddress: '456 Oak Ave',
    billingCity: 'Los Angeles',
    billingState: 'CA',
    billingZipCode: '90210',
    billingCountry: 'US',
    isDefault: true
  },
  {
    cardNumber: '378282246310005', // Amex test card
    expiryMonth: 8,
    expiryYear: 2027,
    cardholderName: 'Bob Wilson',
    cardType: 'amex',
    cardBrand: 'American Express',
    billingAddress: '789 Pine St',
    billingCity: 'Chicago',
    billingState: 'IL',
    billingZipCode: '60601',
    billingCountry: 'US',
    isDefault: true
  },
  {
    cardNumber: '6011111111111117', // Discover test card
    expiryMonth: 6,
    expiryYear: 2028,
    cardholderName: 'Alice Brown',
    cardType: 'discover',
    cardBrand: 'Discover',
    billingAddress: '321 Elm St',
    billingCity: 'Houston',
    billingState: 'TX',
    billingZipCode: '77001',
    billingCountry: 'US',
    isDefault: true
  },
  {
    cardNumber: '4000000000000002', // Visa declined test card
    expiryMonth: 4,
    expiryYear: 2029,
    cardholderName: 'Charlie Davis',
    cardType: 'visa',
    cardBrand: 'Visa',
    billingAddress: '654 Maple Ave',
    billingCity: 'Phoenix',
    billingState: 'AZ',
    billingZipCode: '85001',
    billingCountry: 'US',
    isDefault: true
  }
];

// Sample transaction data
const sampleTransactions = [
  {
    amount: 9999, // $99.99
    currency: 'USD',
    description: 'Test payment - successful',
    status: 'completed',
    cvvProvided: true,
    cvvResult: 'match',
    riskLevel: 'low',
    riskScore: 15,
    processingFee: 299, // $2.99
    merchantId: 'test_merchant_1',
    merchantName: 'Test Store',
    orderId: 'ORDER_001'
  },
  {
    amount: 4999, // $49.99
    currency: 'USD',
    description: 'Test payment - no CVV',
    status: 'completed',
    cvvProvided: false,
    cvvResult: 'not_provided',
    riskLevel: 'medium',
    riskScore: 35,
    processingFee: 149, // $1.49
    merchantId: 'test_merchant_1',
    merchantName: 'Test Store',
    orderId: 'ORDER_002'
  },
  {
    amount: 19999, // $199.99
    currency: 'USD',
    description: 'Test payment - high amount',
    status: 'completed',
    cvvProvided: true,
    cvvResult: 'match',
    riskLevel: 'medium',
    riskScore: 25,
    processingFee: 599, // $5.99
    merchantId: 'test_merchant_2',
    merchantName: 'Electronics Store',
    orderId: 'ORDER_003'
  },
  {
    amount: 2999, // $29.99
    currency: 'USD',
    description: 'Test payment - failed',
    status: 'failed',
    cvvProvided: true,
    cvvResult: 'no_match',
    riskLevel: 'high',
    riskScore: 65,
    processingFee: 0,
    merchantId: 'test_merchant_1',
    merchantName: 'Test Store',
    orderId: 'ORDER_004'
  },
  {
    amount: 7999, // $79.99
    currency: 'USD',
    description: 'Test payment - refunded',
    status: 'refunded',
    cvvProvided: true,
    cvvResult: 'match',
    riskLevel: 'low',
    riskScore: 10,
    processingFee: 239, // $2.39
    merchantId: 'test_merchant_3',
    merchantName: 'Clothing Store',
    orderId: 'ORDER_005'
  }
];

// Sample refund data
const sampleRefunds = [
  {
    amount: 7999, // Full refund of $79.99
    currency: 'USD',
    reason: 'customer_request',
    description: 'Customer requested refund for defective product',
    status: 'completed',
    refundType: 'full',
    refundFee: 0,
    initiatedBy: 'customer',
    merchantId: 'test_merchant_3',
    merchantName: 'Clothing Store'
  }
];

// Create customers
const createCustomers = async () => {
  try {
    logger.info('Creating sample customers...');
    
    for (const customerData of sampleCustomers) {
      const customer = await Customer.create({
        ...customerData,
        customerId: generateCustomerId(),
        passwordHash: hashPassword('password123'),
        emailVerified: true
      });
      
      logger.info(`Created customer: ${customer.email}`);
    }
    
    logger.info('Sample customers created successfully');
  } catch (error) {
    logger.error('Error creating customers:', error);
    throw error;
  }
};

// Create payment methods
const createPaymentMethods = async () => {
  try {
    logger.info('Creating sample payment methods...');
    
    const customers = await Customer.findAll();
    
    for (let i = 0; i < samplePaymentMethods.length && i < customers.length; i++) {
      const customer = customers[i];
      const paymentMethodData = samplePaymentMethods[i];
      
      // Generate card token
      const { token, encryptedData } = generateCardToken(
        paymentMethodData.cardNumber,
        `${paymentMethodData.expiryMonth}/${paymentMethodData.expiryYear}`
      );
      
      const paymentMethod = await PaymentMethod.create({
        customerId: customer.id,
        cardToken: token,
        encryptedCardData: encryptedData,
        cardType: paymentMethodData.cardType,
        cardBrand: paymentMethodData.cardBrand,
        cardLast4: paymentMethodData.cardNumber.slice(-4),
        cardBin: paymentMethodData.cardNumber.substring(0, 6),
        expiryMonth: paymentMethodData.expiryMonth,
        expiryYear: paymentMethodData.expiryYear,
        cardholderName: paymentMethodData.cardholderName,
        billingAddress: paymentMethodData.billingAddress,
        billingCity: paymentMethodData.billingCity,
        billingState: paymentMethodData.billingState,
        billingZipCode: paymentMethodData.billingZipCode,
        billingCountry: paymentMethodData.billingCountry,
        isDefault: paymentMethodData.isDefault
      });
      
      logger.info(`Created payment method for customer: ${customer.email}`);
    }
    
    logger.info('Sample payment methods created successfully');
  } catch (error) {
    logger.error('Error creating payment methods:', error);
    throw error;
  }
};

// Create transactions
const createTransactions = async () => {
  try {
    logger.info('Creating sample transactions...');
    
    const customers = await Customer.findAll({ include: ['paymentMethods'] });
    
    for (let i = 0; i < sampleTransactions.length && i < customers.length; i++) {
      const customer = customers[i];
      const transactionData = sampleTransactions[i];
      const paymentMethod = customer.paymentMethods[0];
      
      if (!paymentMethod) {
        logger.warn(`No payment method found for customer: ${customer.email}`);
        continue;
      }
      
      const transaction = await Transaction.create({
        customerId: customer.id,
        paymentMethodId: paymentMethod.id,
        amount: transactionData.amount,
        currency: transactionData.currency,
        description: transactionData.description,
        status: transactionData.status,
        cvvProvided: transactionData.cvvProvided,
        cvvResult: transactionData.cvvResult,
        riskLevel: transactionData.riskLevel,
        riskScore: transactionData.riskScore,
        processingFee: transactionData.processingFee,
        netAmount: transactionData.amount - transactionData.processingFee,
        merchantId: transactionData.merchantId,
        merchantName: transactionData.merchantName,
        orderId: transactionData.orderId,
        processingStartedAt: new Date(Date.now() - 5000),
        processingCompletedAt: new Date(),
        processingTimeMs: 5000,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        refundableAmount: transactionData.status === 'completed' ? transactionData.amount : 0
      });
      
      logger.info(`Created transaction: ${transaction.transactionId}`);
    }
    
    logger.info('Sample transactions created successfully');
  } catch (error) {
    logger.error('Error creating transactions:', error);
    throw error;
  }
};

// Create refunds
const createRefunds = async () => {
  try {
    logger.info('Creating sample refunds...');
    
    const transactions = await Transaction.findAll({
      where: { status: 'completed' },
      include: ['customer']
    });
    
    for (let i = 0; i < sampleRefunds.length && i < transactions.length; i++) {
      const transaction = transactions[i];
      const refundData = sampleRefunds[i];
      
      const refund = await Refund.create({
        transactionId: transaction.id,
        customerId: transaction.customerId,
        amount: refundData.amount,
        currency: refundData.currency,
        reason: refundData.reason,
        description: refundData.description,
        status: refundData.status,
        refundType: refundData.refundType,
        refundFee: refundData.refundFee,
        netRefundAmount: refundData.amount - refundData.refundFee,
        initiatedBy: refundData.initiatedBy,
        merchantId: refundData.merchantId,
        merchantName: refundData.merchantName,
        processingStartedAt: new Date(Date.now() - 3000),
        processingCompletedAt: new Date(),
        processingTimeMs: 3000
      });
      
      logger.info(`Created refund: ${refund.refundId}`);
    }
    
    logger.info('Sample refunds created successfully');
  } catch (error) {
    logger.error('Error creating refunds:', error);
    throw error;
  }
};

// Main seed function
const seedDatabase = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // Check if data already exists
    const customerCount = await Customer.count();
    if (customerCount > 0) {
      logger.info('Database already contains data, skipping seeding');
      return;
    }
    
    await createCustomers();
    await createPaymentMethods();
    await createTransactions();
    await createRefunds();
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
};

// Export functions
module.exports = {
  seedDatabase,
  createCustomers,
  createPaymentMethods,
  createTransactions,
  createRefunds
};

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase().then(() => {
    logger.info('Database seeding script completed');
    process.exit(0);
  }).catch((error) => {
    logger.error('Database seeding script failed:', error);
    process.exit(1);
  });
}