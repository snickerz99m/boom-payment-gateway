const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    index: true
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  paymentMethodId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'payment_methods',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  // Transaction details
  amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Amount in cents'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Transaction status
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  // Payment processing details
  processingStartedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processingCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  processingTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Processing time in milliseconds'
  },
  // CVV information
  cvvProvided: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  cvvResult: {
    type: DataTypes.ENUM('match', 'no_match', 'not_processed', 'not_provided', 'should_have_been_present'),
    allowNull: false,
    defaultValue: 'not_provided'
  },
  // Risk assessment
  riskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'very_high'),
    allowNull: false,
    defaultValue: 'low'
  },
  riskScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  riskFactors: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('riskFactors');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('riskFactors', JSON.stringify(value || []));
    }
  },
  // Gateway response
  gatewayResponseCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gatewayResponseMessage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gatewayTransactionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Refund information
  refundedAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total refunded amount in cents'
  },
  refundableAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Remaining refundable amount in cents'
  },
  // Fees
  processingFee: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Processing fee in cents'
  },
  netAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Net amount after fees in cents'
  },
  // Merchant information
  merchantId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  merchantName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Order information
  orderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  orderDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const rawValue = this.getDataValue('orderDetails');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('orderDetails', JSON.stringify(value || {}));
    }
  },
  // Customer information at time of transaction
  customerInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const rawValue = this.getDataValue('customerInfo');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('customerInfo', JSON.stringify(value || {}));
    }
  },
  // Request information
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  deviceFingerprint: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Billing information
  billingAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const rawValue = this.getDataValue('billingAddress');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('billingAddress', JSON.stringify(value || {}));
    }
  },
  // Shipping information
  shippingAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const rawValue = this.getDataValue('shippingAddress');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('shippingAddress', JSON.stringify(value || {}));
    }
  },
  // Notification status
  webhookSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  webhookSentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  emailSentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Metadata
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '{}',
    get() {
      const rawValue = this.getDataValue('metadata');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('metadata', JSON.stringify(value || {}));
    }
  },
  // Timestamps
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    {
      fields: ['transactionId']
    },
    {
      fields: ['customerId']
    },
    {
      fields: ['paymentMethodId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['riskLevel']
    },
    {
      fields: ['cvvProvided']
    },
    {
      fields: ['amount']
    },
    {
      fields: ['currency']
    },
    {
      fields: ['merchantId']
    },
    {
      fields: ['orderId']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['processingCompletedAt']
    }
  ]
});

// Instance methods
Transaction.prototype.getFormattedAmount = function() {
  const { formatAmount } = require('../utils/helpers');
  return formatAmount(this.amount, this.currency);
};

Transaction.prototype.getFormattedRefundedAmount = function() {
  const { formatAmount } = require('../utils/helpers');
  return formatAmount(this.refundedAmount, this.currency);
};

Transaction.prototype.getFormattedRefundableAmount = function() {
  const { formatAmount } = require('../utils/helpers');
  return formatAmount(this.refundableAmount, this.currency);
};

Transaction.prototype.isRefundable = function() {
  return this.status === 'completed' && this.refundableAmount > 0;
};

Transaction.prototype.isPartiallyRefunded = function() {
  return this.refundedAmount > 0 && this.refundedAmount < this.amount;
};

Transaction.prototype.isFullyRefunded = function() {
  return this.refundedAmount >= this.amount;
};

Transaction.prototype.canRefund = function(amount) {
  return this.isRefundable() && amount <= this.refundableAmount;
};

Transaction.prototype.getProcessingTimeSeconds = function() {
  if (!this.processingTimeMs) return 0;
  return (this.processingTimeMs / 1000).toFixed(2);
};

Transaction.prototype.getRiskLevelColor = function() {
  const colors = {
    low: 'green',
    medium: 'yellow',
    high: 'orange',
    very_high: 'red'
  };
  return colors[this.riskLevel] || 'gray';
};

Transaction.prototype.updateRefundAmounts = function(refundAmount) {
  this.refundedAmount += refundAmount;
  this.refundableAmount = this.amount - this.refundedAmount;
  
  if (this.refundableAmount <= 0) {
    this.status = 'refunded';
    this.refundableAmount = 0;
  } else {
    this.status = 'partially_refunded';
  }
};

// Class methods
Transaction.findByTransactionId = function(transactionId) {
  return this.findOne({ where: { transactionId } });
};

Transaction.findByCustomer = function(customerId, options = {}) {
  const queryOptions = {
    where: { customerId },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Transaction.findByStatus = function(status, options = {}) {
  const queryOptions = {
    where: { status },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Transaction.findRefundable = function(customerId = null) {
  const where = {
    status: 'completed',
    refundableAmount: { $gt: 0 }
  };
  
  if (customerId) {
    where.customerId = customerId;
  }
  
  return this.findAll({
    where,
    order: [['createdAt', 'DESC']]
  });
};

Transaction.findHighRisk = function(options = {}) {
  const queryOptions = {
    where: {
      riskLevel: ['high', 'very_high']
    },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Transaction.findFailedTransactions = function(options = {}) {
  const queryOptions = {
    where: {
      status: 'failed'
    },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Transaction.getRevenueStats = function(startDate, endDate) {
  return this.findAll({
    where: {
      status: 'completed',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions'],
      [sequelize.fn('AVG', sequelize.col('amount')), 'averageAmount']
    ],
    raw: true
  });
};

// Hooks
Transaction.beforeCreate(async (transaction) => {
  const { generateTransactionId } = require('../utils/helpers');
  if (!transaction.transactionId) {
    transaction.transactionId = generateTransactionId();
  }
  
  // Set refundable amount equal to transaction amount initially
  transaction.refundableAmount = transaction.amount;
  
  // Calculate net amount (amount - processing fee)
  transaction.netAmount = transaction.amount - transaction.processingFee;
});

Transaction.beforeUpdate(async (transaction) => {
  // Update processing time if status changed to completed
  if (transaction.changed('status') && transaction.status === 'completed') {
    if (transaction.processingStartedAt && !transaction.processingCompletedAt) {
      transaction.processingCompletedAt = new Date();
      transaction.processingTimeMs = transaction.processingCompletedAt - transaction.processingStartedAt;
    }
  }
  
  // Update status if processing started
  if (transaction.changed('processingStartedAt') && !transaction.processingStartedAt) {
    transaction.status = 'processing';
  }
});

Transaction.afterCreate(async (transaction) => {
  // Update customer statistics
  const Customer = require('./Customer');
  const customer = await Customer.findByPk(transaction.customerId);
  if (customer) {
    customer.totalTransactions += 1;
    customer.lastTransactionDate = new Date();
    await customer.save();
  }
  
  // Update payment method statistics
  const PaymentMethod = require('./PaymentMethod');
  const paymentMethod = await PaymentMethod.findByPk(transaction.paymentMethodId);
  if (paymentMethod) {
    paymentMethod.totalTransactions += 1;
    paymentMethod.lastUsedDate = new Date();
    await paymentMethod.save();
  }
});

Transaction.afterUpdate(async (transaction) => {
  // Update customer and payment method statistics based on transaction status
  if (transaction.changed('status')) {
    const Customer = require('./Customer');
    const PaymentMethod = require('./PaymentMethod');
    
    const customer = await Customer.findByPk(transaction.customerId);
    const paymentMethod = await PaymentMethod.findByPk(transaction.paymentMethodId);
    
    if (transaction.status === 'completed') {
      if (customer) {
        customer.successfulTransactions += 1;
        customer.totalAmount += transaction.amount;
        await customer.save();
      }
      
      if (paymentMethod) {
        paymentMethod.successfulTransactions += 1;
        paymentMethod.totalAmount += transaction.amount;
        await paymentMethod.save();
      }
    } else if (transaction.status === 'failed') {
      if (customer) {
        customer.failedTransactions += 1;
        await customer.save();
      }
      
      if (paymentMethod) {
        paymentMethod.failedTransactions += 1;
        await paymentMethod.save();
      }
    }
  }
});

module.exports = Transaction;