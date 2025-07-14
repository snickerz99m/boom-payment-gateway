const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('bank_accounts', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      account_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      account_number: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Encrypted bank account number'
      },
      routing_number: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Encrypted routing number'
      },
      account_type: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'checking'
      },
      account_holder_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      account_holder_type: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'individual'
      },
      bank_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
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
      zip_code: {
        type: DataTypes.STRING,
        allowNull: true
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'US'
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending_verification'
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      verification_status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'pending'
      },
      verification_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      auto_payout_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      payout_schedule: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'daily'
      },
      minimum_payout_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 1000,
        comment: 'Minimum payout amount in cents'
      },
      total_payouts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_payout_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total payout amount in cents'
      },
      last_payout_date: {
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
    await queryInterface.addIndex('bank_accounts', ['account_id']);
    await queryInterface.addIndex('bank_accounts', ['status']);
    await queryInterface.addIndex('bank_accounts', ['is_default']);
    await queryInterface.addIndex('bank_accounts', ['verification_status']);
    await queryInterface.addIndex('bank_accounts', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bank_accounts');
  }
};