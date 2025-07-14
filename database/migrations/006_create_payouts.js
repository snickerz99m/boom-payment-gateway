const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('payouts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      payout_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      bank_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'bank_accounts',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
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
      status: {
        type: DataTypes.TEXT,
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
        type: DataTypes.TEXT,
        allowNull: true
      },
      gateway_payout_id: {
        type: DataTypes.STRING,
        allowNull: true
      },
      processing_fee: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: 'Processing fee in cents'
      },
      net_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: 'Net amount after fees in cents'
      },
      payout_type: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'manual'
      },
      failure_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      failure_code: {
        type: DataTypes.STRING,
        allowNull: true
      },
      retry_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      max_retries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3
      },
      next_retry_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      transaction_ids: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: '[]'
      },
      transaction_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    // Create indexes
    await queryInterface.addIndex('payouts', ['payout_id']);
    await queryInterface.addIndex('payouts', ['bank_account_id']);
    await queryInterface.addIndex('payouts', ['status']);
    await queryInterface.addIndex('payouts', ['payout_type']);
    await queryInterface.addIndex('payouts', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payouts');
  }
};