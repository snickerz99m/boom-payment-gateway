const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payout = sequelize.define('Payout', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  payoutId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    index: true
  },
  // Bank account reference
  bankAccountId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'bank_accounts',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  // Payout details
  amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Payout amount in cents'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Payout status
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  // Processing details
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
    allowNull: true
  },
  // Gateway response
  gatewayResponseCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gatewayResponseMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gatewayPayoutId: {
    type: DataTypes.STRING,
    allowNull: true
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
  // Payout type
  payoutType: {
    type: DataTypes.ENUM('manual', 'automatic', 'scheduled'),
    allowNull: false,
    defaultValue: 'manual'
  },
  // Failure details
  failureReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  failureCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3
  },
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Transactions included in this payout
  transactionIds: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('transactionIds');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('transactionIds', JSON.stringify(value || []));
    }
  },
  transactionCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Approval workflow
  requiresApproval: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvalNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Notifications
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
  tableName: 'payouts',
  timestamps: true,
  indexes: [
    {
      fields: ['payoutId']
    },
    {
      fields: ['bankAccountId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['payoutType']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance methods
Payout.prototype.canRetry = function() {
  return (
    this.status === 'failed' &&
    this.retryCount < this.maxRetries &&
    (!this.nextRetryAt || new Date() >= this.nextRetryAt)
  );
};

Payout.prototype.getFormattedAmount = function() {
  return (this.amount / 100).toFixed(2);
};

Payout.prototype.getFormattedFee = function() {
  return (this.processingFee / 100).toFixed(2);
};

Payout.prototype.getFormattedNetAmount = function() {
  return (this.netAmount / 100).toFixed(2);
};

Payout.prototype.markAsProcessing = function() {
  this.status = 'processing';
  this.processingStartedAt = new Date();
  return this.save();
};

Payout.prototype.markAsCompleted = function(gatewayResponse = {}) {
  this.status = 'completed';
  this.processingCompletedAt = new Date();
  this.processingTimeMs = this.processingCompletedAt - this.processingStartedAt;
  
  if (gatewayResponse.code) {
    this.gatewayResponseCode = gatewayResponse.code;
  }
  if (gatewayResponse.message) {
    this.gatewayResponseMessage = gatewayResponse.message;
  }
  if (gatewayResponse.payoutId) {
    this.gatewayPayoutId = gatewayResponse.payoutId;
  }
  
  return this.save();
};

Payout.prototype.markAsFailed = function(reason, code = null) {
  this.status = 'failed';
  this.processingCompletedAt = new Date();
  this.processingTimeMs = this.processingCompletedAt - this.processingStartedAt;
  this.failureReason = reason;
  this.failureCode = code;
  this.retryCount += 1;
  
  // Set next retry time (exponential backoff)
  if (this.retryCount < this.maxRetries) {
    const backoffMs = Math.pow(2, this.retryCount) * 60000; // 2^n minutes
    this.nextRetryAt = new Date(Date.now() + backoffMs);
  }
  
  return this.save();
};

// Class methods
Payout.findByPayoutId = function(payoutId) {
  return this.findOne({ where: { payoutId } });
};

Payout.getPendingPayouts = function() {
  return this.findAll({
    where: { status: 'pending' },
    order: [['createdAt', 'ASC']]
  });
};

Payout.getFailedPayouts = function() {
  return this.findAll({
    where: { status: 'failed' },
    order: [['createdAt', 'DESC']]
  });
};

Payout.getRetryablePayouts = function() {
  const { Op } = require('sequelize');
  return this.findAll({
    where: {
      status: 'failed',
      retryCount: { [Op.lt]: sequelize.col('maxRetries') },
      [Op.or]: [
        { nextRetryAt: null },
        { nextRetryAt: { [Op.lte]: new Date() } }
      ]
    },
    order: [['nextRetryAt', 'ASC']]
  });
};

Payout.getCompletedPayouts = function(startDate, endDate) {
  const { Op } = require('sequelize');
  const where = { status: 'completed' };
  
  if (startDate && endDate) {
    where.processingCompletedAt = {
      [Op.between]: [startDate, endDate]
    };
  }
  
  return this.findAll({
    where,
    order: [['processingCompletedAt', 'DESC']]
  });
};

// Hooks
Payout.beforeCreate(async (payout) => {
  const { generatePayoutId } = require('../utils/helpers');
  
  if (!payout.payoutId) {
    payout.payoutId = generatePayoutId();
  }
  
  // Calculate net amount (amount - processing fee)
  payout.netAmount = payout.amount - payout.processingFee;
});

Payout.beforeUpdate(async (payout) => {
  // Recalculate net amount if amount or fee changed
  if (payout.changed('amount') || payout.changed('processingFee')) {
    payout.netAmount = payout.amount - payout.processingFee;
  }
});

module.exports = Payout;