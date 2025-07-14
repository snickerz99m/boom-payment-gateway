const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('transactions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      transaction_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
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
      payment_method_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'payment_methods',
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
      description: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'),
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
      cvv_provided: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      cvv_result: {
        type: DataTypes.ENUM('match', 'no_match', 'not_processed', 'not_provided', 'should_have_been_present'),
        allowNull: false,
        defaultValue: 'not_provided'
      },
      risk_level: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'very_high'),
        allowNull: false,
        defaultValue: 'low'
      },
      risk_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      risk_factors: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
      },
      gateway_response_code: {
        type: DataTypes.STRING,
        allowNull: true
      },
      gateway_response_message: {
        type: DataTypes.STRING,
        allowNull: true
      },
      gateway_transaction_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      refunded_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      refundable_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      processing_fee: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      net_amount: {
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
      order_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      order_details: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      customer_info: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      device_fingerprint: {
        type: DataTypes.STRING,
        allowNull: true
      },
      billing_address: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
      },
      shipping_address: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
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
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
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
    await queryInterface.addIndex('transactions', ['transaction_id']);
    await queryInterface.addIndex('transactions', ['customer_id']);
    await queryInterface.addIndex('transactions', ['payment_method_id']);
    await queryInterface.addIndex('transactions', ['status']);
    await queryInterface.addIndex('transactions', ['risk_level']);
    await queryInterface.addIndex('transactions', ['cvv_provided']);
    await queryInterface.addIndex('transactions', ['amount']);
    await queryInterface.addIndex('transactions', ['currency']);
    await queryInterface.addIndex('transactions', ['merchant_id']);
    await queryInterface.addIndex('transactions', ['order_id']);
    await queryInterface.addIndex('transactions', ['created_at']);
    await queryInterface.addIndex('transactions', ['processing_completed_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('transactions');
  }
};