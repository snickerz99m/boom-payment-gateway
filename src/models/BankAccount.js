const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BankAccount = sequelize.define('BankAccount', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bankName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [4, 20]
    }
  },
  routingNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [9, 9]
    }
  },
  accountType: {
    type: DataTypes.ENUM('checking', 'savings', 'business'),
    allowNull: false,
    defaultValue: 'checking'
  },
  accountHolderName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending_verification', 'suspended'),
    allowNull: false,
    defaultValue: 'pending_verification'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    defaultValue: 'US'
  },
  verificationStatus: {
    type: DataTypes.ENUM('unverified', 'pending', 'verified', 'failed'),
    allowNull: false,
    defaultValue: 'unverified'
  },
  verificationDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verificationDetails: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  totalPayouts: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0
  },
  totalPayoutAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0
  },
  lastPayoutDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'bank_accounts',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['is_default']
    },
    {
      fields: ['verification_status']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Instance methods
BankAccount.prototype.getMaskedAccountNumber = function() {
  const accountNumber = this.accountNumber;
  return '****' + accountNumber.slice(-4);
};

BankAccount.prototype.canReceivePayouts = function() {
  return this.status === 'active' && this.verificationStatus === 'verified';
};

BankAccount.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  
  // Mask sensitive data
  values.accountNumber = this.getMaskedAccountNumber();
  values.routingNumber = '****' + values.routingNumber.slice(-4);
  
  return values;
};

// Static methods
BankAccount.findByStatus = function(status) {
  return this.findAll({
    where: { status }
  });
};

BankAccount.findDefault = function() {
  return this.findOne({
    where: { isDefault: true, status: 'active' }
  });
};

BankAccount.setDefault = async function(bankAccountId) {
  const transaction = await sequelize.transaction();
  
  try {
    // Remove default from all accounts
    await this.update(
      { isDefault: false },
      { where: { isDefault: true }, transaction }
    );
    
    // Set new default
    await this.update(
      { isDefault: true },
      { where: { id: bankAccountId }, transaction }
    );
    
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = BankAccount;