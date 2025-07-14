const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('refunds', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      refund_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      transaction_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'transactions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      customer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount: {
        type: DataTypes.BIGINT,
        allowNull: false
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
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      processing_started_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      processing_completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      processing_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      gateway_response_code: {
        type: DataTypes.STRING,
        allowNull: true
      },
      gateway_response_message: {
        type: DataTypes.STRING,
        allowNull: true
      },
      gateway_refund_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      refund_type: {
        type: DataTypes.ENUM('full', 'partial'),
        allowNull: false,
        defaultValue: 'partial'
      },
      refund_fee: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      net_refund_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      merchant_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      merchant_name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      initiated_by: {
        type: DataTypes.ENUM('customer', 'merchant', 'admin', 'system'),
        allowNull: false,
        defaultValue: 'customer'
      },
      initiated_by_user_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      requires_approval: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      approved_by: {
        type: DataTypes.STRING,
        allowNull: true
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      approval_notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      webhook_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      webhook_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      email_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      email_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: '{}'
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
    });

    // Add indexes
    await queryInterface.addIndex('refunds', ['refund_id']);
    await queryInterface.addIndex('refunds', ['transaction_id']);
    await queryInterface.addIndex('refunds', ['customer_id']);
    await queryInterface.addIndex('refunds', ['status']);
    await queryInterface.addIndex('refunds', ['reason']);
    await queryInterface.addIndex('refunds', ['refund_type']);
    await queryInterface.addIndex('refunds', ['initiated_by']);
    await queryInterface.addIndex('refunds', ['merchant_id']);
    await queryInterface.addIndex('refunds', ['created_at']);
    await queryInterface.addIndex('refunds', ['processing_completed_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('refunds');
  }
};