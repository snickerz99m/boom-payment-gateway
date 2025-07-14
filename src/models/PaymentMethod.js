const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentMethod = sequelize.define('PaymentMethod', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  // Tokenized card information
  cardToken: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    index: true
  },
  encryptedCardData: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Encrypted card number and expiry'
  },
  // Card metadata (non-sensitive)
  cardType: {
    type: DataTypes.ENUM('visa', 'mastercard', 'amex', 'discover', 'unknown'),
    allowNull: false
  },
  cardBrand: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cardLast4: {
    type: DataTypes.STRING(4),
    allowNull: false
  },
  cardBin: {
    type: DataTypes.STRING(6),
    allowNull: false,
    comment: 'Bank Identification Number'
  },
  expiryMonth: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 12
    }
  },
  expiryYear: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 2020,
      max: 2050
    }
  },
  // Cardholder information
  cardholderName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Billing address
  billingAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  billingCity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  billingState: {
    type: DataTypes.STRING,
    allowNull: true
  },
  billingZipCode: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isZipCode(value) {
        if (value && !/^\d{5}(-\d{4})?$/.test(value)) {
          throw new Error('Invalid ZIP code format');
        }
      }
    }
  },
  billingCountry: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'US'
  },
  // Payment method status
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'expired', 'blocked'),
    allowNull: false,
    defaultValue: 'active'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // Usage statistics
  totalTransactions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  successfulTransactions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  failedTransactions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  totalAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total amount processed in cents'
  },
  lastUsedDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Risk assessment
  riskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'very_high'),
    allowNull: false,
    defaultValue: 'low'
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
  // Validation results
  cvvSupported: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  avsSupported: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
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
  tableName: 'payment_methods',
  timestamps: true,
  indexes: [
    {
      fields: ['customerId']
    },
    {
      fields: ['cardToken']
    },
    {
      fields: ['cardType']
    },
    {
      fields: ['cardLast4']
    },
    {
      fields: ['status']
    },
    {
      fields: ['isDefault']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance methods
PaymentMethod.prototype.isExpired = function() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  return (this.expiryYear < currentYear) || 
         (this.expiryYear === currentYear && this.expiryMonth < currentMonth);
};

PaymentMethod.prototype.getExpiryDate = function() {
  return `${this.expiryMonth.toString().padStart(2, '0')}/${this.expiryYear}`;
};

PaymentMethod.prototype.getSuccessRate = function() {
  if (this.totalTransactions === 0) return 0;
  return (this.successfulTransactions / this.totalTransactions) * 100;
};

PaymentMethod.prototype.updateRiskLevel = function() {
  const successRate = this.getSuccessRate();
  const failureRate = 100 - successRate;
  
  if (failureRate > 50) {
    this.riskLevel = 'very_high';
  } else if (failureRate > 25) {
    this.riskLevel = 'high';
  } else if (failureRate > 10) {
    this.riskLevel = 'medium';
  } else {
    this.riskLevel = 'low';
  }
};

PaymentMethod.prototype.getMaskedCardNumber = function() {
  return `****-****-****-${this.cardLast4}`;
};

// Class methods
PaymentMethod.findByToken = function(cardToken) {
  return this.findOne({ where: { cardToken } });
};

PaymentMethod.findByCustomer = function(customerId) {
  return this.findAll({
    where: { customerId },
    order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
  });
};

PaymentMethod.findActiveByCustomer = function(customerId) {
  return this.findAll({
    where: { 
      customerId,
      status: 'active'
    },
    order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
  });
};

PaymentMethod.findExpiredCards = function() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  return this.findAll({
    where: {
      status: 'active',
      $or: [
        { expiryYear: { $lt: currentYear } },
        {
          expiryYear: currentYear,
          expiryMonth: { $lt: currentMonth }
        }
      ]
    }
  });
};

// Hooks
PaymentMethod.beforeCreate(async (paymentMethod) => {
  // Generate card token if not provided
  if (!paymentMethod.cardToken) {
    const { generateToken } = require('../utils/encryption');
    paymentMethod.cardToken = generateToken();
  }
  
  // Check if this is the first payment method for the customer
  const existingMethods = await PaymentMethod.findByCustomer(paymentMethod.customerId);
  if (existingMethods.length === 0) {
    paymentMethod.isDefault = true;
  }
});

PaymentMethod.beforeSave(async (paymentMethod) => {
  // Update status if card is expired
  if (paymentMethod.isExpired()) {
    paymentMethod.status = 'expired';
  }
  
  // Update risk level if transaction stats changed
  if (paymentMethod.changed('successfulTransactions') || paymentMethod.changed('failedTransactions')) {
    paymentMethod.updateRiskLevel();
  }
});

PaymentMethod.beforeUpdate(async (paymentMethod) => {
  // If setting as default, unset other default methods for this customer
  if (paymentMethod.isDefault && paymentMethod.changed('isDefault')) {
    await PaymentMethod.update(
      { isDefault: false },
      { 
        where: { 
          customerId: paymentMethod.customerId,
          id: { $ne: paymentMethod.id }
        }
      }
    );
  }
});

module.exports = PaymentMethod;