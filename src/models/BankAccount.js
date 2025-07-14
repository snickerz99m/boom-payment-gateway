const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

const BankAccount = sequelize.define('BankAccount', {
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
    }
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bankName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accountNumberEncrypted: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  routingNumberEncrypted: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  accountType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'checking',
    validate: {
      isIn: [['checking', 'savings']]
    }
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending_verification',
    validate: {
      isIn: [['active', 'inactive', 'pending_verification', 'verified']]
    }
  },
  verificationMethod: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['micro_deposits', 'instant', 'plaid']]
    }
  },
  verificationData: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('verificationData');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('verificationData', value ? JSON.stringify(value) : null);
    }
  },
  plaidAccessToken: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  plaidAccountId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true
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
  tableName: 'bank_accounts',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Virtual fields for account number and routing number
BankAccount.prototype.setAccountNumber = function(accountNumber) {
  this.accountNumberEncrypted = encrypt(accountNumber);
};

BankAccount.prototype.getAccountNumber = function() {
  return decrypt(this.accountNumberEncrypted);
};

BankAccount.prototype.setRoutingNumber = function(routingNumber) {
  this.routingNumberEncrypted = encrypt(routingNumber);
};

BankAccount.prototype.getRoutingNumber = function() {
  return decrypt(this.routingNumberEncrypted);
};

// Get masked account number for display
BankAccount.prototype.getMaskedAccountNumber = function() {
  const accountNumber = this.getAccountNumber();
  if (!accountNumber) return '';
  return `****${accountNumber.slice(-4)}`;
};

// Instance method to verify account
BankAccount.prototype.verify = async function(verificationData) {
  this.status = 'verified';
  this.verification_data = verificationData;
  this.verification_method = verificationData.method || 'micro_deposits';
  await this.save();
  return this;
};

// Instance method to deactivate account
BankAccount.prototype.deactivate = async function() {
  this.status = 'inactive';
  await this.save();
  return this;
};

module.exports = BankAccount;