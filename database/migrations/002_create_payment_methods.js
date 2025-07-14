const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('payment_methods', {
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
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      card_token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      encrypted_card_data: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      card_type: {
        type: DataTypes.ENUM('visa', 'mastercard', 'amex', 'discover', 'unknown'),
        allowNull: false
      },
      card_brand: {
        type: DataTypes.STRING,
        allowNull: false
      },
      card_last4: {
        type: DataTypes.STRING(4),
        allowNull: false
      },
      card_bin: {
        type: DataTypes.STRING(6),
        allowNull: false
      },
      expiry_month: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      expiry_year: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      cardholder_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      billing_address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      billing_city: {
        type: DataTypes.STRING,
        allowNull: true
      },
      billing_state: {
        type: DataTypes.STRING,
        allowNull: true
      },
      billing_zip_code: {
        type: DataTypes.STRING,
        allowNull: true
      },
      billing_country: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'US'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'expired', 'blocked'),
        allowNull: false,
        defaultValue: 'active'
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      total_transactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      successful_transactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failed_transactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      last_used_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      risk_level: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'very_high'),
        allowNull: false,
        defaultValue: 'low'
      },
      risk_factors: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: '[]'
      },
      cvv_supported: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      avs_supported: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    await queryInterface.addIndex('payment_methods', ['customer_id']);
    await queryInterface.addIndex('payment_methods', ['card_token']);
    await queryInterface.addIndex('payment_methods', ['card_type']);
    await queryInterface.addIndex('payment_methods', ['card_last4']);
    await queryInterface.addIndex('payment_methods', ['status']);
    await queryInterface.addIndex('payment_methods', ['is_default']);
    await queryInterface.addIndex('payment_methods', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('payment_methods');
  }
};