const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Refund = sequelize.define('Refund', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  refundId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    index: true
  },
  transactionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'transactions',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
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
  // Refund details
  amount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: 'Refund amount in cents'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  reason: {
    type: DataTypes.ENUM(
      'customer_request',
      'duplicate_transaction',
      'fraudulent_transaction',
      'processing_error',
      'merchant_error',
      'chargeback',
      'other'
    ),
    allowNull: false,
    defaultValue: 'customer_request'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Refund status
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
    allowNull: true,
    comment: 'Processing time in milliseconds'
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
  gatewayRefundId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Refund type
  refundType: {
    type: DataTypes.ENUM('full', 'partial'),
    allowNull: false,
    defaultValue: 'partial'
  },
  // Fee information
  refundFee: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Refund processing fee in cents'
  },
  netRefundAmount: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Net refund amount after fees in cents'
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
  // Initiated by
  initiatedBy: {
    type: DataTypes.ENUM('customer', 'merchant', 'admin', 'system'),
    allowNull: false,
    defaultValue: 'customer'
  },
  initiatedByUserId: {
    type: DataTypes.STRING,
    allowNull: true
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
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
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
  tableName: 'refunds',
  timestamps: true,
  indexes: [
    {
      fields: ['refundId']
    },
    {
      fields: ['transactionId']
    },
    {
      fields: ['customerId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['reason']
    },
    {
      fields: ['refundType']
    },
    {
      fields: ['initiatedBy']
    },
    {
      fields: ['merchantId']
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
Refund.prototype.getFormattedAmount = function() {
  const { formatAmount } = require('../utils/helpers');
  return formatAmount(this.amount, this.currency);
};

Refund.prototype.getFormattedNetAmount = function() {
  const { formatAmount } = require('../utils/helpers');
  return formatAmount(this.netRefundAmount, this.currency);
};

Refund.prototype.getFormattedFee = function() {
  const { formatAmount } = require('../utils/helpers');
  return formatAmount(this.refundFee, this.currency);
};

Refund.prototype.getProcessingTimeSeconds = function() {
  if (!this.processingTimeMs) return 0;
  return (this.processingTimeMs / 1000).toFixed(2);
};

Refund.prototype.isApprovalRequired = function() {
  return this.requiresApproval && !this.approvedAt;
};

Refund.prototype.isApproved = function() {
  return this.approvedAt !== null;
};

Refund.prototype.canCancel = function() {
  return ['pending', 'processing'].includes(this.status);
};

Refund.prototype.canApprove = function() {
  return this.status === 'pending' && this.requiresApproval && !this.approvedAt;
};

Refund.prototype.getStatusColor = function() {
  const colors = {
    pending: 'yellow',
    processing: 'blue',
    completed: 'green',
    failed: 'red',
    cancelled: 'gray'
  };
  return colors[this.status] || 'gray';
};

Refund.prototype.getReasonDisplayName = function() {
  const reasonNames = {
    customer_request: 'Customer Request',
    duplicate_transaction: 'Duplicate Transaction',
    fraudulent_transaction: 'Fraudulent Transaction',
    processing_error: 'Processing Error',
    merchant_error: 'Merchant Error',
    chargeback: 'Chargeback',
    other: 'Other'
  };
  return reasonNames[this.reason] || 'Unknown';
};

// Class methods
Refund.findByRefundId = function(refundId) {
  return this.findOne({ where: { refundId } });
};

Refund.findByTransaction = function(transactionId, options = {}) {
  const queryOptions = {
    where: { transactionId },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Refund.findByCustomer = function(customerId, options = {}) {
  const queryOptions = {
    where: { customerId },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Refund.findByStatus = function(status, options = {}) {
  const queryOptions = {
    where: { status },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Refund.findPendingApproval = function(options = {}) {
  const queryOptions = {
    where: {
      requiresApproval: true,
      approvedAt: null,
      status: 'pending'
    },
    order: [['createdAt', 'ASC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Refund.findByMerchant = function(merchantId, options = {}) {
  const queryOptions = {
    where: { merchantId },
    order: [['createdAt', 'DESC']],
    ...options
  };
  return this.findAll(queryOptions);
};

Refund.getTotalRefundedAmount = function(transactionId) {
  return this.findAll({
    where: {
      transactionId,
      status: 'completed'
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalRefunded']
    ],
    raw: true
  });
};

Refund.getRefundStats = function(startDate, endDate) {
  return this.findAll({
    where: {
      status: 'completed',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalRefunded'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalRefunds'],
      [sequelize.fn('AVG', sequelize.col('amount')), 'averageRefund']
    ],
    raw: true
  });
};

// Hooks
Refund.beforeCreate(async (refund) => {
  const { generateRefundId } = require('../utils/helpers');
  if (!refund.refundId) {
    refund.refundId = generateRefundId();
  }
  
  // Calculate net refund amount
  refund.netRefundAmount = refund.amount - refund.refundFee;
  
  // Determine if this is a full refund
  const Transaction = require('./Transaction');
  const transaction = await Transaction.findByPk(refund.transactionId);
  if (transaction) {
    const totalRefunded = await Refund.getTotalRefundedAmount(refund.transactionId);
    const currentTotalRefunded = (totalRefunded[0]?.totalRefunded || 0) + refund.amount;
    
    if (currentTotalRefunded >= transaction.amount) {
      refund.refundType = 'full';
    } else {
      refund.refundType = 'partial';
    }
  }
});

Refund.beforeUpdate(async (refund) => {
  // Update processing time if status changed to completed
  if (refund.changed('status') && refund.status === 'completed') {
    if (refund.processingStartedAt && !refund.processingCompletedAt) {
      refund.processingCompletedAt = new Date();
      refund.processingTimeMs = refund.processingCompletedAt - refund.processingStartedAt;
    }
  }
  
  // Update status if processing started
  if (refund.changed('processingStartedAt') && refund.processingStartedAt) {
    refund.status = 'processing';
  }
});

Refund.afterCreate(async (refund) => {
  // Update transaction refund amounts
  const Transaction = require('./Transaction');
  const transaction = await Transaction.findByPk(refund.transactionId);
  if (transaction) {
    transaction.updateRefundAmounts(refund.amount);
    await transaction.save();
  }
});

Refund.afterUpdate(async (refund) => {
  // Send notifications when refund is completed
  if (refund.changed('status') && refund.status === 'completed') {
    // Here you would typically trigger webhook and email notifications
    // For now, we'll just log the completion
    const { logger } = require('../utils/logger');
    logger.info(`Refund ${refund.refundId} completed for amount ${refund.getFormattedAmount()}`);
  }
});

module.exports = Refund;