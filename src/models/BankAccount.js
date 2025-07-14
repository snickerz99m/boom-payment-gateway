const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BankAccount = sequelize.define('BankAccount', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    index: true
  },
  // Bank account details (encrypted)
  accountNumber: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Encrypted bank account number'
  },
  routingNumber: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Encrypted routing number'
  },
  accountType: {
    type: DataTypes.ENUM('checking', 'savings', 'business'),
    allowNull: false,
    defaultValue: 'checking'
  },
  // Account holder information
  accountHolderName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accountHolderType: {
    type: DataTypes.ENUM('individual', 'business'),
    allowNull: false,
    defaultValue: 'individual'
  },
  // Bank information
  bankName: {
    type: DataTypes.STRING,
    allowNull: false
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
    allowNull: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'US'
  },
  // Account status
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
  // Verification
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  verificationDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Payout settings
  autoPayoutEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  payoutSchedule: {
    type: DataTypes.ENUM('immediate', 'daily', 'weekly', 'monthly'),
    allowNull: false,
    defaultValue: 'daily'
  },
  minimumPayoutAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 1000, // $10.00 in cents
    comment: 'Minimum payout amount in cents'
  },
  // Statistics
  totalPayouts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  totalPayoutAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total payout amount in cents'
  },
  lastPayoutDate: {
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
  indexes: [
    {
      fields: ['accountId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['isDefault']
    },
    {
      fields: ['verificationStatus']
    }
  ]
});

// Instance methods
BankAccount.prototype.getMaskedAccountNumber = function() {
  const { decrypt } = require('../utils/encryption');
  try {
    const decrypted = decrypt(this.accountNumber);
    return `****${decrypted.slice(-4)}`;
  } catch (error) {
    return '****';
  }
};

BankAccount.prototype.getDecryptedAccountNumber = function() {
  const { decrypt } = require('../utils/encryption');
  return decrypt(this.accountNumber);
};

BankAccount.prototype.getDecryptedRoutingNumber = function() {
  const { decrypt } = require('../utils/encryption');
  return decrypt(this.routingNumber);
};

BankAccount.prototype.isEligibleForPayout = function(amount) {
  return (
    this.status === 'active' &&
    this.verificationStatus === 'verified' &&
    amount >= this.minimumPayoutAmount
  );
};

// Class methods
BankAccount.findByAccountId = function(accountId) {
  return this.findOne({ where: { accountId } });
};

BankAccount.getDefaultAccount = function() {
  return this.findOne({ where: { isDefault: true, status: 'active' } });
};

BankAccount.getActiveAccounts = function() {
  return this.findAll({
    where: { status: 'active' },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
  });
};

// Hooks
BankAccount.beforeCreate(async (account) => {
  const { generateAccountId } = require('../utils/helpers');
  const { encrypt } = require('../utils/encryption');
  
  if (!account.accountId) {
    account.accountId = generateAccountId();
  }
  
  // Encrypt sensitive data
  if (account.accountNumber) {
    account.accountNumber = encrypt(account.accountNumber);
  }
  if (account.routingNumber) {
    account.routingNumber = encrypt(account.routingNumber);
  }
});

BankAccount.beforeUpdate(async (account) => {
  const { encrypt } = require('../utils/encryption');
  
  // Encrypt sensitive data if it has changed
  if (account.changed('accountNumber') && account.accountNumber) {
    account.accountNumber = encrypt(account.accountNumber);
  }
  if (account.changed('routingNumber') && account.routingNumber) {
    account.routingNumber = encrypt(account.routingNumber);
  }
  
  // If this account is being set as default, unset others
  if (account.changed('isDefault') && account.isDefault) {
    await BankAccount.update(
      { isDefault: false },
      { where: { isDefault: true, id: { [require('sequelize').Op.ne]: account.id } } }
    );
  }
});

module.exports = BankAccount;