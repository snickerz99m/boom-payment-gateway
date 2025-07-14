const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('bank_accounts', {
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
        defaultValue: 'checking'
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending_verification'
      },
      verification_method: {
        type: DataTypes.STRING,
        allowNull: true
      },
      verification_data: {
        type: DataTypes.TEXT,
        allowNull: true
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
    });

    // Add indexes
    await queryInterface.addIndex('bank_accounts', ['customer_id']);
    await queryInterface.addIndex('bank_accounts', ['status']);
    await queryInterface.addIndex('bank_accounts', ['account_type']);
    await queryInterface.addIndex('bank_accounts', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('bank_accounts');
  }
};