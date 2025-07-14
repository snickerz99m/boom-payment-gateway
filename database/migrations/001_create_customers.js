const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('customers', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      customer_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      date_of_birth: {
        type: DataTypes.DATEONLY,
        allowNull: true
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
        allowNull: true,
        defaultValue: 'US'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended', 'blocked'),
        allowNull: false,
        defaultValue: 'active'
      },
      risk_level: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'very_high'),
        allowNull: false,
        defaultValue: 'low'
      },
      total_transactions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: DataTypes.BIGINT,
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
      last_transaction_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: true
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      email_verification_token: {
        type: DataTypes.STRING,
        allowNull: true
      },
      password_reset_token: {
        type: DataTypes.STRING,
        allowNull: true
      },
      password_reset_expires: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ip_address: {
        type: DataTypes.STRING,
        allowNull: true
      },
      user_agent: {
        type: DataTypes.TEXT,
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
    await queryInterface.addIndex('customers', ['customer_id']);
    await queryInterface.addIndex('customers', ['email']);
    await queryInterface.addIndex('customers', ['status']);
    await queryInterface.addIndex('customers', ['risk_level']);
    await queryInterface.addIndex('customers', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('customers');
  }
};