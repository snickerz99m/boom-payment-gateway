const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    index: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isPhoneNumber(value) {
        if (value && !/^\+?[1-9]\d{1,14}$/.test(value.replace(/\D/g, ''))) {
          throw new Error('Invalid phone number format');
        }
      }
    }
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  // Address information
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  zipCode: {
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
  country: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'US'
  },
  // Customer status
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended', 'blocked'),
    allowNull: false,
    defaultValue: 'active'
  },
  // Risk assessment
  riskLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'very_high'),
    allowNull: false,
    defaultValue: 'low'
  },
  // Customer statistics
  totalTransactions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  totalAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total amount in cents'
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
  lastTransactionDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Authentication
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Tracking
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
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
  tableName: 'customers',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['customerId']
    },
    {
      fields: ['email']
    },
    {
      fields: ['status']
    },
    {
      fields: ['riskLevel']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance methods
Customer.prototype.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

Customer.prototype.getSuccessRate = function() {
  if (this.totalTransactions === 0) return 0;
  return (this.successfulTransactions / this.totalTransactions) * 100;
};

Customer.prototype.updateRiskLevel = function() {
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

// Class methods
Customer.findByCustomerId = function(customerId) {
  return this.findOne({ where: { customerId } });
};

Customer.findByEmail = function(email) {
  return this.findOne({ where: { email } });
};

Customer.getHighRiskCustomers = function() {
  return this.findAll({
    where: {
      riskLevel: ['high', 'very_high']
    },
    order: [['updatedAt', 'DESC']]
  });
};

// Hooks
Customer.beforeCreate(async (customer) => {
  const { generateCustomerId } = require('../utils/helpers');
  if (!customer.customerId) {
    customer.customerId = generateCustomerId();
  }
});

Customer.beforeUpdate(async (customer) => {
  if (customer.changed('successfulTransactions') || customer.changed('failedTransactions')) {
    customer.updateRiskLevel();
  }
});

module.exports = Customer;