const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

const BankAccount = sequelize.define('BankAccount', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  account_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bank_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  account_number_encrypted: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  routing_number_encrypted: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  account_type: {
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
  verification_method: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['micro_deposits', 'instant', 'plaid']]
    }
  },
  verification_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('verification_data');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('verification_data', value ? JSON.stringify(value) : null);
    }
  },
  plaid_access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  plaid_account_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_used_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'bank_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Virtual fields for account number and routing number
BankAccount.prototype.setAccountNumber = function(accountNumber) {
  this.account_number_encrypted = encrypt(accountNumber);
};

BankAccount.prototype.getAccountNumber = function() {
  return decrypt(this.account_number_encrypted);
};

BankAccount.prototype.setRoutingNumber = function(routingNumber) {
  this.routing_number_encrypted = encrypt(routingNumber);
};

BankAccount.prototype.getRoutingNumber = function() {
  return decrypt(this.routing_number_encrypted);
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